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

def get_jwks_keys():
    global _jwks_cache
    if not _jwks_cache:
        try:
            jwks_url = f"{KEYCLOAK_URL.rstrip('/')}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
            with httpx.Client(timeout=10.0) as client:
                response = client.get(jwks_url)
                response.raise_for_status()
                _jwks_cache = response.json()
        except Exception as e:
            # We fail silently here but get_jwks_keys will return empty list, failing verify
            pass
    return _jwks_cache.get("keys", [])

def verify_token(token: str) -> Dict[str, Any]:
    try:
        # Get unverified header to find kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token header is missing 'kid'.",
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
        
        # Verify token claims and signature
        issuer_url = f"{KEYCLOAK_URL.rstrip('/')}/realms/{KEYCLOAK_REALM}"
        
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
