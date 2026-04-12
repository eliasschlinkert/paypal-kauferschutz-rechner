const FEES = {
  standard: { rate: 0.0249, fixed: 0.35 },
  micro:    { rate: 0.0499, fixed: 0.09, threshold: 10 },
  abroad:   { ewr: 0.0129, nonEwr: 0.0199 }
};

const amountIn     = document.getElementById('amountIn');
const euroWrap     = document.getElementById('euroWrap');
const amountError  = document.getElementById('amountError');
const clearAllBtn  = document.getElementById('clearAll');
const abroadToggle = document.getElementById('abroadToggle');
const ewrWrapper   = document.getElementById('ewrWrapper');
const ewrInBtn     = document.getElementById('ewrIn');
const ewrOutBtn    = document.getElementById('ewrOut');
const sendAmountEl = document.getElementById('sendAmount');
const desiredEl    = document.getElementById('desiredDisplay');
const feeEl        = document.getElementById('feeDisplay');
const tariffEl     = document.getElementById('tariffDisplay');
const copyBtn      = document.getElementById('copyBtn');
const copyToast    = document.getElementById('copyToast');

const nf = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmt(n) {
  return nf.format(n).replace(/ /g, '\u202f');
}

function parseInput(s) {
  const cleaned = (s || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const v = Number(cleaned);
  return Number.isFinite(v) && v >= 0 ? v : NaN;
}

function countDigits(s) {
  return (s.match(/[0-9]/g) || []).length;
}

const MAX_DIGITS = 6;

function calculate() {
  const raw = amountIn.value.trim();

  if (!raw) {
    resetResult();
    return;
  }

  const amount = parseInput(raw);

  if (isNaN(amount) || amount <= 0) {
    resetResult();
    return;
  }

  const abroad  = abroadToggle.checked;
  const isEwr   = ewrInBtn.classList.contains('active');

  const isMicro = amount < FEES.micro.threshold;
  const base    = isMicro ? FEES.micro : FEES.standard;
  let rate      = base.rate;
  const fixed   = base.fixed;

  const baseName = isMicro ? 'Mikro' : 'Standard';
  let tariffStr  = baseName;

  if (abroad) {
    const surcharge = isEwr ? FEES.abroad.ewr : FEES.abroad.nonEwr;
    rate += surcharge;
    tariffStr += isEwr ? ' · EWR' : ' · Ausland';
  }

  const sendAmount = round2((amount + fixed) / (1 - rate));
  const fee        = round2(sendAmount - amount);
  const rateStr    = (rate * 100).toFixed(2).replace('.', ',');
  const fixedStr   = fixed.toFixed(2).replace('.', ',');
  const fullTariff = `${tariffStr} · ${rateStr}% + ${fixedStr}\u202f€`;

  sendAmountEl.textContent = fmt(sendAmount);
  desiredEl.textContent    = fmt(amount);
  feeEl.textContent        = '+ ' + fmt(fee);
  tariffEl.textContent     = fullTariff;
  tariffEl.title           = fullTariff;
}

function resetResult() {
  sendAmountEl.textContent = fmt(0);
  desiredEl.textContent    = fmt(0);
  feeEl.textContent        = '+ ' + fmt(0);
  tariffEl.textContent     = '–';
  tariffEl.title           = '';
}

amountIn.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Dead') { e.preventDefault(); shake(euroWrap); return; }
  if (e.key.length > 1) return;
  if (!/^[0-9,.]$/.test(e.key)) { e.preventDefault(); shake(euroWrap); }
});

amountIn.addEventListener('beforeinput', (e) => {
  if (!e.data) return;

  const start = amountIn.selectionStart ?? 0;
  const end   = amountIn.selectionEnd   ?? amountIn.value.length;
  const val   = amountIn.value;
  const base  = val.substring(0, start) + val.substring(end);

  if (e.data === '.') {
    e.preventDefault();
    if (base.includes(',') || base.length === 0) { shake(euroWrap); return; }
    amountIn.value = val.substring(0, start) + ',' + val.substring(end);
    amountIn.setSelectionRange(start + 1, start + 1);
    hideError();
    calculate();
    return;
  }

  if (!/^[0-9,]$/.test(e.data)) {
    e.preventDefault();
    shake(euroWrap);
    return;
  }

  if (e.data === ',') {
    if (base.includes(',') || base.length === 0) { e.preventDefault(); shake(euroWrap); }
    return;
  }

  if (/^[0-9]$/.test(e.data)) {
    if (e.data === '0' && countDigits(val.substring(0, start)) === 0) {
      e.preventDefault();
      shake(euroWrap);
      return;
    }
    if (countDigits(base) + 1 > MAX_DIGITS) {
      e.preventDefault();
      showError();
      return;
    }
    const commaIdx = base.indexOf(',');
    if (commaIdx !== -1 && start > commaIdx) {
      const decimals = base.substring(commaIdx + 1).replace(/[^0-9]/g, '').length;
      if (decimals >= 2) {
        e.preventDefault();
        shake(euroWrap);
        return;
      }
    }
  }
});

amountIn.addEventListener('paste', (e) => {
  e.preventDefault();
  const raw  = (e.clipboardData || window.clipboardData).getData('text');
  const text = normalizePasteInput(raw);
  if (text === null) { shake(euroWrap); return; }

  const start  = amountIn.selectionStart ?? 0;
  const end    = amountIn.selectionEnd   ?? amountIn.value.length;
  const val    = amountIn.value;
  const newVal = val.substring(0, start) + text + val.substring(end);

  if ((newVal.match(/,/g) || []).length > 1) { shake(euroWrap); return; }
  const ci = newVal.indexOf(',');
  if (ci !== -1 && newVal.substring(ci + 1).replace(/[^0-9]/g, '').length > 2) {
    shake(euroWrap); return;
  }
  if (countDigits(newVal) > MAX_DIGITS) { showError(); return; }

  amountIn.value = newVal;
  amountIn.setSelectionRange(start + text.length, start + text.length);
  hideError();
  calculate();
});

function normalizePasteInput(raw) {
  const s      = raw.trim().replace(/[^0-9,.]/g, '');
  const dots   = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (!s) return null;
  if (dots === 0 && commas === 0) return s;
  if (dots === 0 && commas === 1) return s;
  if (dots === 1 && commas === 0) return s.replace('.', ',');
  if (dots >= 1 && commas === 1) return s.replace(/\./g, '');
  return null;
}

amountIn.addEventListener('input', () => {
  hideError();
  calculate();
});

function showError() {
  amountError.textContent = 'Maximal 6 Ziffern erlaubt';
  amountError.classList.add('visible');
  shake(amountError);
}
function hideError() {
  amountError.classList.remove('visible');
}

clearAllBtn.addEventListener('click', () => {
  amountIn.value = '';
  hideError();
  resetResult();
  amountIn.focus();
});

abroadToggle.addEventListener('change', () => {
  ewrWrapper.classList.toggle('open', abroadToggle.checked);
  calculate();
});

function setEwr(activeBtn, inactiveBtn) {
  activeBtn.classList.add('active');
  activeBtn.setAttribute('aria-pressed', 'true');
  inactiveBtn.classList.remove('active');
  inactiveBtn.setAttribute('aria-pressed', 'false');
  calculate();
}

ewrInBtn.addEventListener('click',  () => setEwr(ewrInBtn,  ewrOutBtn));
ewrOutBtn.addEventListener('click', () => setEwr(ewrOutBtn, ewrInBtn));

let copyTimeout = null;

copyBtn.addEventListener('click', () => {
  const raw = sendAmountEl.textContent
    .replace(/\./g, '')
    .replace(/[\u202f\s€]/g, '');
  if (raw === '0,00' || raw === '') return;
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(raw).then(() => {
    copyBtn.classList.add('copied');
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => copyBtn.classList.remove('copied'), 1500);

    copyToast.classList.remove('show');
    void copyToast.offsetWidth;
    copyToast.classList.add('show');
  }).catch(() => {});
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    const infoPanel = document.getElementById('infoPanel');
    if (infoPanel && infoPanel.classList.contains('open')) {
      closeInfoPanel();
      return;
    }
    amountIn.value = '';
    hideError();
    resetResult();
    amountIn.focus();
  }
});

const credit      = document.getElementById('credit');
const creditHeart = document.getElementById('creditHeart');

creditHeart.addEventListener('animationend', () => {
  creditHeart.classList.remove('beating');
});

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  creditHeart.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !credit.classList.contains('expanded');
    credit.classList.toggle('expanded');
    if (opening) {
      creditHeart.classList.remove('beating');
      void creditHeart.offsetWidth;
      creditHeart.classList.add('beating');
    }
  });
  document.addEventListener('click', (e) => {
    if (!credit.contains(e.target)) credit.classList.remove('expanded');
  });
} else {
  credit.addEventListener('mouseenter', () => {
    creditHeart.classList.remove('beating');
    void creditHeart.offsetWidth;
    creditHeart.classList.add('beating');
  });
}

const mobileInfoBtn  = document.getElementById('mobileInfoBtn');
const infoPanelEl    = document.getElementById('infoPanel');
const infoPanelClose = document.getElementById('infoPanelClose');
const mobileBackdrop = document.getElementById('mobileBackdrop');

function openInfoPanel() {
  infoPanelEl.classList.add('open');
  mobileBackdrop.classList.add('visible');
  mobileInfoBtn.setAttribute('aria-expanded', 'true');
}

function closeInfoPanel() {
  infoPanelEl.classList.remove('open');
  mobileBackdrop.classList.remove('visible');
  mobileInfoBtn.setAttribute('aria-expanded', 'false');
}

mobileInfoBtn.addEventListener('click', () => {
  if (infoPanelEl.classList.contains('open')) {
    closeInfoPanel();
  } else {
    openInfoPanel();
  }
});

infoPanelClose.addEventListener('click', closeInfoPanel);
mobileBackdrop.addEventListener('click', closeInfoPanel);

resetResult();
amountIn.focus();
