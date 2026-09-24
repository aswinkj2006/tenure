import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Cpu, 
  FileText, 
  Sparkles, 
  AlertTriangle, 
  Sliders, 
  Search,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import useSensorStore from '../../stores/sensorStore';
import './CommandPalette.css';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const toggleReduceEffects = useSensorStore((s) => s.toggleReduceEffects);
  const reduceEffects = useSensorStore((s) => s.reduceEffects);
  const triggerAnomaly = useSensorStore((s) => s.triggerAnomaly);
  const setSelectedJoint = useSensorStore((s) => s.setSelectedJoint);

  // Toggle on Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command) => {
    setOpen(false);
    command();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Tenure Command Menu"
      className="command-dialog glass-strong"
    >
      <div className="command-search-header">
        <Search size={16} className="command-search-icon" />
        <Command.Input
          placeholder="Search navigation, telemetry, or ask Tenure AI..."
          className="command-input"
        />
        <kbd className="command-esc-badge font-mono">ESC</kbd>
      </div>

      <Command.List className="command-list">
        <Command.Empty className="command-empty">No results found.</Command.Empty>

        <Command.Group heading="Navigation">
          <Command.Item
            onSelect={() => runCommand(() => navigate('/'))}
            className="command-item"
          >
            <LayoutDashboard size={15} />
            <span>Dashboard Overview</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/machine/ur5e-001'))}
            className="command-item"
          >
            <Cpu size={15} />
            <span>UR5e Telemetry & 3D Twin</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/logs'))}
            className="command-item"
          >
            <FileText size={15} />
            <span>Diagnostic & Incident Logs</span>
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Joint Telemetry Inspection">
          {['Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3'].map((name, i) => (
            <Command.Item
              key={name}
              onSelect={() =>
                runCommand(() => {
                  navigate('/machine/ur5e-001');
                  setSelectedJoint(i);
                  toast.info(`Focusing on Joint ${i + 1} (${name})`);
                })
              }
              className="command-item"
            >
              <Sliders size={14} />
              <span>Inspect Joint {i + 1} ({name})</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Actions & Simulation">
          <Command.Item
            onSelect={() =>
              runCommand(() => {
                triggerAnomaly(2);
                toast.error('Triggered Elbow Joint Torque Anomaly (185.2 Nm)');
                navigate('/machine/ur5e-001');
              })
            }
            className="command-item command-item-danger"
          >
            <AlertTriangle size={15} />
            <span>Simulate Collision / Over-Torque Anomaly</span>
          </Command.Item>
          <Command.Item
            onSelect={() =>
              runCommand(() => {
                toggleReduceEffects();
                toast.success(
                  reduceEffects ? 'Rich Atmosphere & Glass enabled' : 'Reduce Effects mode enabled'
                );
              })
            }
            className="command-item"
          >
            <CheckCircle2 size={15} />
            <span>Toggle Reduce Effects Mode ({reduceEffects ? 'Currently ON' : 'Currently OFF'})</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
