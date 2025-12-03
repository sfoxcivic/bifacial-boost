// Full frontend logic for Bifacial Boost Estimator (Polished UI)
// Uploads PDF as base64 to Netlify function /.netlify/functions/extract
// Receives Isc, Imp, fuse, bifacialNote, rawText

const $ = (id) => document.getElementById(id);

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadAndExtract() {
  const fileInput = $('pdf');
  const file = fileInput.files[0];
  if (!file) {
    updateStatus('Please choose a PDF file first.', true);
    return;
  }
  updateStatus('Uploading and extracting…', false);
  try {
    const base64 = await fileToBase64(file);
    const resp = await fetch('/.netlify/functions/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: base64 })
    });
    const data = await resp.json();
    if (data.error) {
      updateStatus('Extraction error: ' + data.error, true);
      return;
    }
    // Populate fields
    if (data.Isc) $('isc').value = data.Isc;
    if (data.Imp) $('imp').value = data.Imp;
    if (data.fuse) $('fuse').value = data.fuse;
    if (data.bifacialNote) {
      alert('⚠️ Datasheet indicates bifacial/bifacial correction notes present.');
    }
    $('extractedPreview').textContent = data.raw || (data.extractedText || '').slice(0, 3000);
    updateStatus('Extraction complete.', false);
  } catch (err) {
    console.error(err);
    updateStatus('Upload failed: ' + err.message, true);
  }
}

function updateStatus(msg, isError=false) {
  const el = $('extractStatus');
  el.textContent = msg;
  el.className = isError ? 'text-sm text-red-600 mt-2' : 'text-sm text-slate-500 mt-2';
}

function baseBoost(albedo, mount) {
  const table = [
    { max: 0.11, fixed: 0.04, tracker: 0.05 },
    { max: 0.25, fixed: 0.07, tracker: 0.09 },
    { max: 0.40, fixed: 0.10, tracker: 0.12 },
    { max: 0.70, fixed: 0.15, tracker: 0.18 },
    { max: 1.00, fixed: 0.22, tracker: 0.25 }
  ];
  const row = table.find(r => albedo <= r.max);
  return mount === 'tracker' ? row.tracker : row.fixed;
}

function clearanceMultiplier(h) {
  if (h < 0.8) return 0.7;
  if (h < 1.2) return 0.9;
  if (h < 1.5) return 1.0;
  return 1.15;
}

function gcrMultiplier(g) {
  if (g >= 0.60) return 0.85;
  if (g <= 0.40) return 1.10;
  return 1.0;
}

function obstructionMultiplier(o) {
  return o === 'bulky' ? 0.85 : 1.0;
}

function calculateBoost() {
  const albedo = parseFloat($('albedo').value);
  const mount = $('mount').value;
  const clearance = parseFloat($('clearance').value) || 1.2;
  const gcr = parseFloat($('gcr').value) || 0.5;
  const obstruction = $('obstruction').value;

  const isc = parseFloat($('isc').value);
  const imp = parseFloat($('imp').value);
  const fuse = parseFloat($('fuse').value);

  if (!isc || !imp) {
    alert('Please provide module Isc and Imp (either manually or via PDF extraction).');
    return;
  }

  let boost = baseBoost(albedo, mount);
  boost *= clearanceMultiplier(clearance);
  boost *= gcrMultiplier(gcr);
  boost *= obstructionMultiplier(obstruction);

  const isc_eff = isc * (1 + boost);
  const imp_eff = imp * (1 + boost);

  $('boostVal').textContent = (boost * 100).toFixed(1) + ' %';
  $('iscVal').textContent = isc_eff.toFixed(2);
  $('impVal').textContent = imp_eff.toFixed(2);

  // Suggested note: compare with fuse / manufacturer limits
  let notes = [];
  if (fuse) {
    notes.push('Sheet max fuse: ' + fuse + ' A');
  }
  notes.push('Apply NEC continuous factors and manufacturer max input currents.');
  $('notesVal').textContent = notes.join(' ');
}

function resetForm() {
  $('pdf').value = '';
  $('isc').value = '';
  $('imp').value = '';
  $('fuse').value = '';
  $('extractedPreview').textContent = 'No extraction performed yet.';
  $('boostVal').textContent = '—';
  $('iscVal').textContent = '—';
  $('impVal').textContent = '—';
  $('notesVal').textContent = '—';
  updateStatus('No file loaded.', false);
}

// event listeners
document.addEventListener('DOMContentLoaded', () => {
  $('extractBtn').addEventListener('click', uploadAndExtract);
  $('calcBtn').addEventListener('click', calculateBoost);
  $('resetBtn').addEventListener('click', resetForm);

  // enable Enter-key calculate when in numbers
  ['isc','imp','gcr','clearance'].forEach(id => {
    $(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') calculateBoost();
    });
  });
});
