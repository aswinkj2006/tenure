import sys, json
sys.path.insert(0, '.')
from services.orchestrator.recurrence_engine import analyze_recurrence

result = analyze_recurrence(
    machine_id='ur5e-001',
    anomaly_id='anm-demo-recur-001',
    flagged_sensors=['joint_3_torque', 'joint_5_torque'],
    current_severity='high',
)

print(f"\n{'='*60}")
print(f"  xAI ATTRIBUTION RESULT")
print(f"{'='*60}")
print(f"  Attribution : {result['attribution_label']}")
print(f"  Confidence  : {result['confidence']*100:.0f}%")
print(f"  Recurrences : {result['recurrence_count']}")
print(f"  Excluded    : {result['excluded_technicians']}")
print(f"\n  REASONING CHAIN ({len(result['reasoning_chain'])} steps):")
for step in result['reasoning_chain']:
    symbol = {'machine_fault': '🔴', 'technician_skill_gap': '🟡', 'systemic': '🟣', 'neutral': '⚪', 'ambiguous': '🔵'}.get(step['verdict_contribution'], '⚫')
    print(f"\n  Step {step['step']}: {step['label']} {symbol}")
    print(f"    {step['finding']}")

print(f"\n  RECOMMENDED ACTION:")
print(f"  {result['recommended_action']}")
print(f"\n  SMART DISPATCH NOTES:")
print(f"  {result['smart_dispatch_notes']}")
