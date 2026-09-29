const routes = {
  feature: {
    number: '01', name: 'Feature', title: 'Make the intended behavior real.',
    description: 'For new or changed user behavior, start with the outcome and a few observable cases when the change is substantial. Build in slices and check the integrated result.',
    steps: ['Describe the outcome and material cases', 'Decide which design or component checks help', 'Implement and observe the real user path', 'Open a PR with the contract and proof'],
    example: '“Add a reading list that survives reload.”'
  },
  bug: {
    number: '02', name: 'Bug fix', title: 'Follow the reported failure.',
    description: 'Reproduce the symptom on its real surface, find the cause, and rerun the same path after the smallest supported fix.',
    steps: ['Reproduce the reported symptom', 'Find the cause in code and history', 'Fix the mechanism', 'Rerun the original path and open a PR'],
    example: '“Edits disappear after I save and reopen.”'
  },
  refactor: {
    number: '03', name: 'Refactor', title: 'Change the structure. Hold the behavior.',
    description: 'Pin the output that must stay the same, make the code easier to understand, and compare the result before opening a PR.',
    steps: ['Name the behavior to preserve', 'Record a test or equivalent output', 'Move code in small steps', 'Compare the result and open a PR'],
    example: '“Move the parser behind a smaller interface.”'
  },
  performance: {
    number: '04', name: 'Performance', title: 'Measure the path people feel.',
    description: 'Choose a user or operational metric, measure a baseline, change the likely bottleneck, and compare under similar conditions.',
    steps: ['Choose the metric', 'Measure a baseline', 'Change one plausible cause', 'Compare and report the result in a PR'],
    example: '“Cut report generation from four seconds to two.”'
  },
  investigation: {
    number: '05', name: 'Investigation', title: 'Find out before changing anything.',
    description: 'Use code, history, the running product, or primary documentation to answer a question. Separate observed facts from inference.',
    steps: ['Gather relevant evidence', 'Separate fact from inference', 'Answer with tradeoffs when useful', 'Stop with the answer'],
    example: '“Why is the tenant check in the backend?”'
  },
  pr: {
    number: '06', name: 'Pull request', title: 'Review the change against its intent.',
    description: 'Inspect the full diff, trace affected consumers, assess the proof, and make authorized fixes on the same branch.',
    steps: ['Read the diff and intended outcome', 'Trace affected paths and review quality', 'Check proof and material gaps', 'Update the existing PR when fixes are needed'],
    example: '“Review PR #42 and fix the regression.”'
  },
  control: {
    number: '07', name: 'App control', title: 'Make the real product drivable.',
    description: 'Create or repair a project-owned command and feature map so later work can reach, act on, and observe the product.',
    steps: ['Inspect the product and working drivers', 'Create or adopt the control command', 'Map user entry points', 'Drive one real path and open a PR'],
    example: '“Set up AStack to verify our web app.”'
  },
  setup: {
    number: '08', name: 'Project setup', title: 'Fit AStack to the project.',
    description: 'Inspect the existing stack and working commands. Keep them where they work, record the project profile, and add product control when the app needs it.',
    steps: ['Inspect the repository and scripts', 'Keep the working stack', 'Record commands and proof routes', 'Drive one real path when the project has an app'],
    example: '“Adopt AStack in an existing pnpm app.”'
  }
};

const map = document.querySelector('#route-map');
const mapScroll = document.querySelector('.map-scroll');
const workbench = document.querySelector('#route-workbench');
const picker = document.querySelector('#trace-panel');
const browseButton = document.querySelector('#browse-requests');
const detail = document.querySelector('#route-detail');
const search = document.querySelector('#request-search');
const results = document.querySelector('#request-results');
const requestCount = document.querySelector('#request-count');
let scenarios = [];
let openedRoute = null;
let selectedIndex = null;
const visibleByRoute = {};

function renderInlineCode(target, value) {
  target.replaceChildren(...value.split(/(`[^`]+`)/g).filter(Boolean).map((part) => {
    if (!part.startsWith('`')) return document.createTextNode(part);
    const code = document.createElement('code');
    code.textContent = part.slice(1, -1);
    return code;
  }));
}

function centerLine(key) {
  const line = map.querySelector(`[data-map-route="${key}"]`);
  if (!line || mapScroll.clientWidth >= map.scrollWidth) return;
  const left = line.offsetLeft - (mapScroll.clientWidth - line.clientWidth) / 2;
  mapScroll.scrollTo({ left, behavior: 'smooth' });
}

function setPickerOpen(open) {
  picker.hidden = !open;
  browseButton.setAttribute('aria-expanded', String(open));
  if (open) search.focus();
  else if (picker.contains(document.activeElement)) browseButton.focus();
}

function selectRoute(key, scenarioIndex = null) {
  const route = routes[key];
  if (!route) return;
  const scenario = scenarioIndex === null ? null : scenarios[scenarioIndex];
  openedRoute = key;
  selectedIndex = scenarioIndex;
  map.classList.add('has-selection');
  for (const lane of map.querySelectorAll('[data-map-route]')) {
    lane.classList.toggle('is-active', lane.dataset.mapRoute === key);
  }
  for (const branch of map.querySelectorAll('[data-branch-route]')) {
    branch.classList.toggle('is-active', branch.dataset.branchRoute === key);
  }
  detail.hidden = false;
  detail.style.setProperty('--active-route', getComputedStyle(map.querySelector(`[data-map-route="${key}"]`)).getPropertyValue('--route'));
  document.querySelector('#route-kicker').textContent = key === 'setup' ? 'PROJECT SETUP PATH' : 'ROUTE ' + route.number + ' / ' + route.name.toUpperCase();
  document.querySelector('#route-title').textContent = scenario ? `“${scenario.request}”` : route.title;
  document.querySelector('#route-decision-label').textContent = scenario ? 'EXPECTED DECISION FROM THE EVAL' : 'ABOUT THIS ROUTE';
  if (scenario) renderInlineCode(document.querySelector('#route-description'), scenario.decision);
  else document.querySelector('#route-description').textContent = route.description;
  renderResults();
  setPickerOpen(false);
  (matchMedia('(max-width: 680px)').matches ? detail : workbench).scrollIntoView({ block: 'start', behavior: 'smooth' });
  centerLine(key);
}

function renderResults() {
  const query = search.value.trim().toLocaleLowerCase();
  const groups = [];
  let matchCount = 0;
  for (const [key, route] of Object.entries(routes)) {
    const matches = scenarios.map((scenario, index) => ({ ...scenario, index }))
      .filter((scenario) => scenario.route === key && (!query || scenario.request.toLocaleLowerCase().includes(query)));
    if (query && matches.length === 0) continue;
    matchCount += matches.length;
    const group = document.createElement('div');
    group.className = 'request-group';
    group.style.setProperty('--result-route', getComputedStyle(map.querySelector(`[data-map-route="${key}"]`)).getPropertyValue('--route'));
    const expanded = query ? openedRoute !== `closed:${key}` : openedRoute === key;
    const heading = document.createElement('button');
    heading.type = 'button';
    heading.className = 'request-group-heading';
    heading.setAttribute('aria-expanded', String(expanded));
    heading.innerHTML = `<span class="request-group-name"></span><span class="request-group-count"></span><span class="request-group-arrow" aria-hidden="true">⌄</span>`;
    heading.querySelector('.request-group-name').textContent = route.name;
    heading.querySelector('.request-group-count').textContent = `${matches.length} ${matches.length === 1 ? 'example' : 'examples'}`;
    heading.addEventListener('click', () => {
      openedRoute = expanded ? (query ? `closed:${key}` : null) : key;
      renderResults();
    });
    group.append(heading);
    if (expanded) {
      const list = document.createElement('div');
      list.className = 'request-group-list';
      const limit = visibleByRoute[key] || 5;
      for (const scenario of matches.slice(0, limit)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'request-result';
        button.setAttribute('aria-pressed', String(selectedIndex === scenario.index));
        button.textContent = scenario.request;
        button.addEventListener('click', () => selectRoute(key, scenario.index));
        list.append(button);
      }
      if (matches.length > limit) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'more-requests';
        more.textContent = `Show ${Math.min(5, matches.length - limit)} more`;
        more.addEventListener('click', () => { visibleByRoute[key] = limit + 5; renderResults(); });
        list.append(more);
      }
      group.append(list);
    }
    groups.push(group);
  }
  results.replaceChildren(...groups);
  requestCount.textContent = query
    ? `${matchCount} matching ${matchCount === 1 ? 'example' : 'examples'} across ${groups.length} ${groups.length === 1 ? 'route' : 'routes'}`
    : `${scenarios.length} eval examples across ${Object.keys(routes).length} lines`;
  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'request-empty';
    empty.textContent = 'No matching example. Try another term.';
    results.append(empty);
  }
}

Promise.resolve().then(async () => {
  try {
    const response = await fetch('./scenarios.json');
    if (!response.ok) throw new Error('Could not load routing examples');
    scenarios = await response.json();
    renderResults();
  } catch {
    requestCount.textContent = 'Routing examples are unavailable. Choose a line on the map.';
  }
});

function clearSelection() {
  detail.hidden = true;
  map.classList.remove('has-selection');
  for (const lane of map.querySelectorAll('[data-map-route]')) lane.classList.remove('is-active');
  for (const branch of map.querySelectorAll('[data-branch-route]')) branch.classList.remove('is-active');
  selectedIndex = null;
  openedRoute = null;
  renderResults();
}

search.addEventListener('input', renderResults);
browseButton.addEventListener('click', () => setPickerOpen(picker.hidden));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !picker.hidden) setPickerOpen(false);
});
for (const button of document.querySelectorAll('[data-map-select]')) {
  button.addEventListener('click', () => selectRoute(button.dataset.mapSelect));
}
document.querySelector('#show-all-routes').addEventListener('click', () => {
  search.value = '';
  clearSelection();
  setPickerOpen(false);
});

const themeButton = document.querySelector('#theme-toggle');
const themeIcon = document.querySelector('#theme-icon');
const themeLabel = themeButton.querySelector('.theme-label');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  themeIcon.textContent = dark ? '☼' : '☾';
  themeLabel.textContent = dark ? 'Light' : 'Dark';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111827' : '#d7dfe7';
}
applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('astack-theme', next); } catch { /* The page still changes theme. */ }
});

const copyButton = document.querySelector('#copy-command');
copyButton.addEventListener('click', async () => {
  const command = document.querySelector('#install-command');
  try {
    await navigator.clipboard.writeText(command.textContent);
    copyButton.textContent = 'Copied';
    copyButton.setAttribute('aria-label', 'Installation commands copied');
  } catch {
    const range = document.createRange();
    range.selectNodeContents(command);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    copyButton.textContent = 'Selected';
    copyButton.setAttribute('aria-label', 'Installation commands selected; press copy');
  }
  window.setTimeout(() => {
    copyButton.textContent = 'Copy';
    copyButton.setAttribute('aria-label', 'Copy installation commands');
  }, 2500);
});
