#!/usr/bin/env python3
import subprocess
import json
import sys

token = subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()
rules_content = open("firestore.rules").read()

# Step 1: Create ruleset
ruleset_payload = {
    "source": {
        "files": [
            {
                "content": rules_content,
                "name": "firestore.rules"
            }
        ]
    }
}

result = subprocess.run([
    "curl", "-s", "-X", "POST",
    "https://firebaserules.googleapis.com/v1/projects/paymesh-c9611/rulesets",
    "-H", f"Authorization: Bearer {token}",
    "-H", "Content-Type: application/json",
    "-d", json.dumps(ruleset_payload)
], capture_output=True, text=True)

ruleset = json.loads(result.stdout)
print("Ruleset:", json.dumps(ruleset, indent=2))

if "name" not in ruleset:
    print("Failed to create ruleset", file=sys.stderr)
    sys.exit(1)

ruleset_name = ruleset["name"]

# Step 2: Update the Firestore release to use the new ruleset
release_payload = {
    "release": {
        "name": "projects/paymesh-c9611/releases/cloud.firestore",
        "rulesetName": ruleset_name
    }
}

result2 = subprocess.run([
    "curl", "-s", "-X", "PATCH",
    "https://firebaserules.googleapis.com/v1/projects/paymesh-c9611/releases/cloud.firestore",
    "-H", f"Authorization: Bearer {token}",
    "-H", "Content-Type: application/json",
    "-d", json.dumps(release_payload)
], capture_output=True, text=True)

release = json.loads(result2.stdout)
print("Release update:", json.dumps(release, indent=2))
