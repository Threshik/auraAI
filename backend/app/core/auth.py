import httpx
import jwt
from jwt.algorithms import RSAAlgorithm
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import KEYCLOAK_URL, KEYCLOAK_REALM
from typing import Dict, Any

security = HTTPBearer()

# Cache JWKS keys
_jwks_cache: Dict[str, Any] = {}

def _candidate_realm_urls() -> list[str]:
    """Generate likely realm base URLs across Keycloak distributions.

    Some providers expose realms under /auth/realms/... while others use /realms/...
    """
    base = KEYCLOAK_URL.rstrip("/")
    realm = KEYCLOAK_REALM
    candidates = [
        f"{base}/realms/{realm}",
        f"{base}/auth/realms/{realm}",
    ]
    if base.endswith("/auth"):
        root = base[:-5].rstrip("/")
        candidates.append(f"{root}/realms/{realm}")

    # Deduplicate while preserving order.
    seen = set()
    unique: list[str] = []
    for u in candidates:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    return unique

def get_jwks_keys():
    global _jwks_cache
    if not _jwks_cache:
        with httpx.Client(timeout=10.0) as client:
            for realm_url in _candidate_realm_urls():
                try:
                    jwks_url = f"{realm_url}/protocol/openid-connect/certs"
                    response = client.get(jwks_url)
                    response.raise_for_status()
                    data = response.json()
                    if data.get("keys"):
                        _jwks_cache = data
                        _jwks_cache["_realm_url"] = realm_url
                        break
                except Exception:
                    continue
    return _jwks_cache.get("keys", [])

def verify_token(token: str) -> Dict[str, Any]:
    try:
        # Get unverified header to find kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        alg = unverified_header.get("alg", "")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token header is missing 'kid'.",
            )
        if isinstance(alg, str) and alg.startswith("HS"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token uses HS* signing. Configure Keycloak realm/client access token algorithm to RS256 for JWKS validation.",
            )
            
        keys = get_jwks_keys()
        jwk = next((k for k in keys if k["kid"] == kid), None)
        if not jwk:
            # Force cache refresh and try again
            global _jwks_cache
            _jwks_cache = {}
            keys = get_jwks_keys()
            jwk = next((k for k in keys if k["kid"] == kid), None)
            if not jwk:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Signing key not found in JWKS.",
                )

        public_key = RSAAlgorithm.from_jwk(jwk)

        # Decode and verify
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={
                "verify_aud": False,
                "verify_iss": False,  # Disable aud and iss verification for local dev network compatibility
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    payload = verify_token(token)
    
    # Extract and upsert user info
    user_id = payload.get("sub")
    if user_id:
        from app.core.database import SessionLocal
        from app.models.user import User
        from datetime import datetime
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                user = User(
                    id=user_id,
                    username=payload.get("preferred_username"),
                    email=payload.get("email"),
                    first_name=payload.get("given_name"),
                    last_name=payload.get("family_name"),
                    last_login=datetime.utcnow()
                )
                db.add(user)
            else:
                user.username = payload.get("preferred_username")
                user.email = payload.get("email")
                user.first_name = payload.get("given_name")
                user.last_name = payload.get("family_name")
                user.last_login = datetime.utcnow()
            db.commit()
        except Exception as e:
            print(f"Failed to auto-upsert user record: {e}")
        finally:
            db.close()
            
    return payload
