import os
import re
import requests

def main():
    env_vars = {}
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    
    if not os.path.exists(env_path):
        print(f"Error: .env file not found at {env_path}")
        return
        
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^([^=]+)=(.*)$", line)
            if m:
                key = m.group(1).strip()
                val = m.group(2).strip()
                if val.startswith('"') and val.endswith('"'):
                    val = val[1:-1]
                elif val.startswith("'") and val.endswith("'"):
                    val = val[1:-1]
                env_vars[key] = val

    google_client_id = env_vars.get("GOOGLE_CLIENT_ID")
    google_client_secret = env_vars.get("GOOGLE_CLIENT_SECRET")
    
    if not google_client_id or "placeholder" in google_client_id:
        print("Error: GOOGLE_CLIENT_ID is not configured or is still placeholder in .env")
        return
        
    print(f"Found Google Client ID: {google_client_id[:10]}...")

    # 1. Get admin token
    try:
        token_res = requests.post(
            "http://localhost:8080/realms/master/protocol/openid-connect/token",
            data={
                "client_id": "admin-cli",
                "username": "admin",
                "password": "admin",
                "grant_type": "password",
            }
        ).json()
        access_token = token_res["access_token"]
    except Exception as e:
        print("Error: Failed to authenticate with Keycloak. Is Keycloak running on port 8080?", e)
        return

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # 2. Get Google IDP configuration
    url = "http://localhost:8080/admin/realms/myrealm/identity-provider/instances/google"
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        idp_data = res.json()
        
        # 3. Update with variables from .env
        idp_data["config"]["clientId"] = google_client_id
        idp_data["config"]["clientSecret"] = google_client_secret
        
        # 4. Save config back
        put_res = requests.put(url, headers=headers, json=idp_data)
        if put_res.status_code in [200, 204]:
            print("Successfully configured Google Identity Provider in Keycloak!")
        else:
            print(f"Failed to update config: {put_res.status_code} - {put_res.text}")
    else:
        print(f"Failed to fetch config: {res.status_code} - {res.text}")

if __name__ == "__main__":
    main()
