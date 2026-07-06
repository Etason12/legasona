import requests
import json

# Login
r = requests.post('https://legasonaimporter.onrender.com/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'},
    headers={'Content-Type': 'application/json'})
print('Login status:', r.status_code)
print('Login response:', r.text[:500] if r.text else 'Empty')

if r.status_code == 200:
    data = r.json()
    token = data.get('access_token')
    if token:
        print('Token:', token[:50] + '...')
        
        # Now call dashboard with the token
        headers = {'Authorization': f'Bearer {token}'}
        dr = requests.get('https://legasonaimporter.onrender.com/api/reports/dashboard', headers=headers)
        print('\nDashboard status:', dr.status_code)
        print('Dashboard response:', dr.text[:1000] if dr.text else 'Empty')
        
        # Also try without branch_id
        dr2 = requests.get('https://legasonaimporter.onrender.com/api/reports/dashboard?branch_id=', headers=headers)
        print('\nDashboard (branch_id=) status:', dr2.status_code)
        print('Dashboard (branch_id=) response:', dr2.text[:1000] if dr2.text else 'Empty')
