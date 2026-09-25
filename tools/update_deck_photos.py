import json

with open('tools/processed_images.json', 'r') as f:
    images = json.load(f)

with open('deck.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add SVG Duotone Filter if not present
svg_filter = '''  <!-- SVG Duotone Filter for Industrial Machinery Photos -->
  <svg style="position: absolute; width: 0; height: 0; pointer-events: none;" aria-hidden="true">
    <filter id="machinery-duotone" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="
        0.2126 0.7152 0.0722 0 0
        0.2126 0.7152 0.0722 0 0
        0.2126 0.7152 0.0722 0 0
        0      0      0      1 0" result="gray" />
      <feComponentTransfer in="gray" result="duotone">
        <feFuncR type="table" tableValues="0.200 0.722 0.886" />
        <feFuncG type="table" tableValues="0.141 0.447 0.804" />
        <feFuncB type="table" tableValues="0.082 0.231 0.698" />
      </feComponentTransfer>
    </filter>
  </svg>'''

if '<filter id="machinery-duotone"' not in content:
    content = content.replace('<body>', '<body>\n' + svg_filter)

# 2. Add styles for the silo media wrap
silo_css_inject = '''
    .silos-cluster {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
      margin: 2rem 0 1.5rem;
      flex: 1;
    }

    .silo-box {
      background: rgba(255, 251, 245, 0.88);
      backdrop-filter: blur(10px);
      border-radius: 14px;
      padding: 1.25rem;
      border: 1px dashed rgba(178, 58, 46, 0.35);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(51, 36, 21, 0.04);
    }

    .silo-media-wrap {
      position: relative;
      width: 100%;
      height: 140px;
      margin: 0.85rem 0;
      border-radius: 8px;
      overflow: hidden;
      background: var(--charcoal);
    }

    .silo-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: url(#machinery-duotone) contrast(1.12) brightness(0.96);
      display: block;
      transform: scale(1.02);
      transition: transform 600ms var(--ease-out-expo), opacity 500ms ease;
    }

    .slide.active .silo-photo {
      transform: scale(1);
    }

    .silo-media-wrap::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: 
        radial-gradient(circle at center, transparent 40%, rgba(51, 36, 21, 0.22) 100%),
        linear-gradient(to bottom, transparent 55%, rgba(255, 251, 245, 0.8) 100%),
        radial-gradient(rgba(51, 36, 21, 0.12) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 6px 6px;
    }
'''

# 3. New Slide 3 HTML
new_slide_3 = f'''    <!-- ----------------------------------------------------------------------
         SLIDE 3: THE PROBLEM - SILOED MACHINERY (BLUSH TONE)
         ---------------------------------------------------------------------- -->
    <section class="slide" id="slide-3" data-index="3">
      <div class="kicker" style="color: var(--rust);">[ 03 // THE PROBLEM ]</div>
      <h2 class="headline" style="font-size: clamp(2rem, 3.8vw, 3.4rem); margin-bottom: 0.5rem;">
        Dozens of vendors. Dozens of isolated monitors.
      </h2>
      <p class="supporting">
        Operators drown in fragmented data and react to breakdowns instead of preventing them.
      </p>

      <div class="silos-cluster">
        <!-- Silo 1: UR5e Robotic Arm -->
        <div class="silo-box">
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 0.35rem;">
              <span class="silo-pulse-dot"></span>
              <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;">UR5e Robotic Arm</span>
            </div>
            <p style="font-size: 0.78rem; color: rgba(51,36,21,0.75);">Proprietary Teach Pendant</p>
          </div>

          <div class="silo-media-wrap">
            <img class="silo-photo" src="{images['ur5']}" alt="UR5e Robotic Cobot Arm" loading="eager" />
          </div>

          <div style="background: rgba(51,36,21,0.06); padding: 0.65rem; border-radius: 8px; font-family: var(--font-mono); font-size: 0.75rem; z-index: 2;">
            <code>FAULT 0x4A: Joint 3 Overheat</code>
          </div>
        </div>

        <!-- Silo 2: CNC Lathe Cell -->
        <div class="silo-box">
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 0.35rem;">
              <span class="silo-pulse-dot"></span>
              <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;">CNC Lathe Cell</span>
            </div>
            <p style="font-size: 0.78rem; color: rgba(51,36,21,0.75);">Vendor Controller Monitor</p>
          </div>

          <div class="silo-media-wrap">
            <img class="silo-photo" src="{images['cnc']}" alt="CNC Lathe Turning Center" loading="eager" />
          </div>

          <div style="background: rgba(51,36,21,0.06); padding: 0.65rem; border-radius: 8px; font-family: var(--font-mono); font-size: 0.75rem; z-index: 2;">
            <code>ALARM 204: Spindle Runout</code>
          </div>
        </div>

        <!-- Silo 3: Hydraulic Press #4 -->
        <div class="silo-box">
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 0.35rem;">
              <span class="silo-pulse-dot"></span>
              <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;">Hydraulic Press #4</span>
            </div>
            <p style="font-size: 0.78rem; color: rgba(51,36,21,0.75);">Analog Gauge Cluster</p>
          </div>

          <div class="silo-media-wrap">
            <img class="silo-photo" src="{images['hydraulic']}" alt="Hydraulic Press Machine" loading="eager" />
          </div>

          <div style="background: rgba(51,36,21,0.06); padding: 0.65rem; border-radius: 8px; font-family: var(--font-mono); font-size: 0.75rem; z-index: 2;">
            <code>VALVE PRESSURE DROP: 42 Bar</code>
          </div>
        </div>

        <!-- Silo 4: Conveyor Drive #2 -->
        <div class="silo-box">
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 0.35rem;">
              <span class="silo-pulse-dot"></span>
              <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;">Conveyor Drive #2</span>
            </div>
            <p style="font-size: 0.78rem; color: rgba(51,36,21,0.75);">Isolated Inverter Terminal</p>
          </div>

          <div class="silo-media-wrap">
            <img class="silo-photo" src="{images['conveyor']}" alt="Industrial Conveyor Belt Drive" loading="eager" />
          </div>

          <div style="background: rgba(51,36,21,0.06); padding: 0.65rem; border-radius: 8px; font-family: var(--font-mono); font-size: 0.75rem; z-index: 2;">
            <code>BEARING HARMONIC VIB: 4.8 kHz</code>
          </div>
        </div>
      </div>

      <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--rust); font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
        <span>RESULT: UNPLANNED DOWNTIME • SCRAP MATERIAL SPOILAGE • OPERATOR FATIGUE</span>
      </div>
    </section>'''

# Find the whole slide 3 block from <section class="slide" id="slide-3" to </section>
start_marker = '<section class="slide" id="slide-3" data-index="3">'
end_marker = '</section>'
idx_start = content.find(start_marker)
idx_end = content.find(end_marker, idx_start) + len(end_marker)

if idx_start != -1 and idx_end != -1:
    content = content[:idx_start] + new_slide_3 + content[idx_end:]

with open('deck.html', 'w', encoding='utf-8') as f:
    f.write(content)

with open('frontend/public/deck.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Slide 3 updated with duotone photos successfully!")
