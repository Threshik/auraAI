import httpx
import re

auth_url = "http://localhost:8080/realms/myrealm/protocol/openid-connect/auth"
params = {
    "client_id": "myclient",
    "redirect_uri": "http://localhost:3000/",
    "response_type": "code",
    "scope": "openid"
}

with httpx.Client(follow_redirects=False) as client:
    # 1. Get login page (sets cookies in client session)
    resp = client.get(auth_url, params=params)
    print("Auth Page Status:", resp.status_code)
    
    # Extract the relative Google link
    html = resp.text
    match = re.search(r'href="([^"]*broker/google/login[^"]*)"', html)
    if not match:
        match = re.search(r'href="([^"]*/broker/[^"]*/login[^"]*)"', html)
        
    if match:
        google_link = match.group(1).replace("&amp;", "&")
        if google_link.startswith("/"):
            google_link = "http://localhost:8080" + google_link
        print("Found Google link:", google_link)
        
        # 2. Get Google redirect URL (cookies are automatically sent because it's a Client session)
        resp2 = client.get(google_link)
        print("Google Link Status:", resp2.status_code)
        if "location" in resp2.headers:
            print("Redirect Location to Google:")
            print(resp2.headers["location"])
        else:
            print("Final URL:", resp2.url)
            # Print first 200 chars of HTML body to see error page
            print("Response text:", resp2.text[:500])
    else:
        print("No Google link found in HTML.")
