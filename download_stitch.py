import json
import os
import subprocess

screens_file = '/Users/erick/.gemini/antigravity/brain/40ed5773-f2f7-432f-a5b0-23242c52bff2/.system_generated/steps/11/output.txt'
ds_file = '/Users/erick/.gemini/antigravity/brain/40ed5773-f2f7-432f-a5b0-23242c52bff2/.system_generated/steps/12/output.txt'
target_dir = '/Users/erick/Documents/Proyectos/IA/Finanzas/stitch_screens'

os.makedirs(target_dir, exist_ok=True)

# Generate a unified way to process screens
with open(screens_file, 'r') as f:
    screens_data = json.load(f)

for screen in screens_data.get('screens', []):
    title = screen.get('title', 'Unknown')
    # Filter only requested screens... wait, the user requested basically all of them? Let me just download all that match the IDs or all of them since they are exactly 13 screens.
    # Actually there are exactly 13 screens in the `list_screens` output!
    screen_id = screen['name'].split('/')[-1]
    
    html_url = screen.get('htmlCode', {}).get('downloadUrl')
    img_url = screen.get('screenshot', {}).get('downloadUrl')
    
    # Clean up title for filename
    safe_title = title.replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '')
    
    html_path = os.path.join(target_dir, f"{safe_title}_{screen_id}.html")
    img_path = os.path.join(target_dir, f"{safe_title}_{screen_id}.png")
    
    if html_url:
        print(f"Downloading HTML for {title}...")
        subprocess.run(['curl', '-L', '-s', '-o', html_path, html_url], check=True)
        
    if img_url:
        print(f"Downloading image for {title}...")
        subprocess.run(['curl', '-L', '-s', '-o', img_path, img_url], check=True)

# Process Design Systems
with open(ds_file, 'r') as f:
    ds_data = json.load(f)

for ds in ds_data.get('designSystems', []):
    ds_id = ds['name'].split('/')[-1]
    title = ds.get('designSystem', {}).get('displayName', 'Design_System')
    safe_title = title.replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '')
    
    json_path = os.path.join(target_dir, f"{safe_title}_{ds_id}.json")
    print(f"Saving Design System {title}...")
    with open(json_path, 'w') as out_f:
        json.dump(ds.get('designSystem', {}), out_f, indent=2)

print("Done downloading all requested items.")
