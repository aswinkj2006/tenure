import sys
sys.path.insert(0, '.')
from services.orchestrator.dispatch_module import rank_technicians, check_inventory, get_all_technicians

techs = get_all_technicians()
print(f'Technicians loaded: {len(techs)}')
for t in techs:
    print(f'  {t["name"]} ({t["certification_level"]}) - {t["availability"]}')

ranked = rank_technicians(['joint_3_torque', 'joint_5_torque'], 'high')
print('\nRanked (top 3):')
for i, t in enumerate(ranked[:3]):
    print(f'  #{i+1} {t["name"]} -- score {t["rank_score"]} | matched: {t["matched_skills"]}')

parts = check_inventory('ur5e-001')
oos = [p for p in parts if not p['in_stock']]
print(f'\nInventory: {len(parts)} parts, {len(oos)} OOS')
for p in oos:
    print(f'  OOS: {p["part_number"]} - {p["name"]}')
