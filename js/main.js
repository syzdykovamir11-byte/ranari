document.querySelectorAll('[data-rail]').forEach(setupCarousel);

const menu = document.querySelector('.mobile-menu');
const menuSummary = menu.querySelector('summary');
menu.addEventListener('click', event => {
  if (event.target.closest('a[href^="#"]')) menu.open = false;
});
menu.addEventListener('focusout', event => {
  if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
});
menu.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menuSummary.focus();
  }
});
document.addEventListener('click', event => {
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
matchMedia('(min-width: 850px)').addEventListener('change', event => {
  if (event.matches) menu.open = false;
});

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const jlpt = document.querySelector('[data-jlpt]');
const tabList = jlpt.querySelector('.jlpt-tabs');
const tabs = [...tabList.querySelectorAll('[role="tab"]')];
const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
// Sliding selection adapted from 21st Animated Tabs by kuratlielia.
const tabIndicator = document.createElement('span');
tabIndicator.className = 'jlpt-tab-indicator';
tabIndicator.setAttribute('aria-hidden', 'true');
tabList.prepend(tabIndicator);
let selectedLevel = 0;
let levelAnimation = null;

panels.forEach((panel, index) => {
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tabs[index].id);
  panel.tabIndex = 0;
});

function selectLevel(index, animate = true) {
  const direction = Math.sign(index - selectedLevel);
  levelAnimation?.cancel();
  tabs.forEach((tab, position) => {
    const selected = position === index;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[position].hidden = !selected;
  });
  if (animate && direction && !reducedMotion.matches) {
    levelAnimation = panels[index].animate(
      [{ opacity: .38, transform: `translateX(${direction * 14}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' }
    );
  }
  selectedLevel = index;
  positionTabIndicator();
}

function positionTabIndicator() {
  const tab = tabs[selectedLevel];
  tabIndicator.style.width = `${tab.offsetWidth}px`;
  tabIndicator.style.transform = `translateX(${tab.offsetLeft}px)`;
}

tabs.forEach((tab, index) => tab.addEventListener('click', () => selectLevel(index)));
tabList.addEventListener('keydown', event => {
  const keys = { ArrowLeft: -1, ArrowRight: 1 };
  let index;
  if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = tabs.length - 1;
  else if (event.key in keys) index = (selectedLevel + keys[event.key] + tabs.length) % tabs.length;
  else return;
  event.preventDefault();
  selectLevel(index);
  tabs[index].focus();
});
tabList.hidden = false;
selectLevel(0, false);
requestAnimationFrame(() => tabList.classList.add('has-indicator'));
if ('ResizeObserver' in window) new ResizeObserver(positionTabIndicator).observe(tabList);
else window.addEventListener('resize', positionTabIndicator);

const branches = [...document.querySelectorAll('[data-sakura]')];
const visibleBranches = new Set();
let branchFrame = null;

function updateBranches() {
  branchFrame = null;
  if (reducedMotion.matches) return;
  const start = innerHeight * .85;
  const shifts = [...visibleBranches].map(branch => {
    const top = branch.parentElement.getBoundingClientRect().top;
    return [branch, -Math.min(112, Math.max(0, (start - top) * .14))];
  });
  shifts.forEach(([branch, offset]) => branch.style.setProperty('--branch-shift', `${Math.round(offset)}px`));
}

function requestBranchUpdate() {
  if (visibleBranches.size && branchFrame === null && !reducedMotion.matches) {
    branchFrame = requestAnimationFrame(updateBranches);
  }
}

if ('IntersectionObserver' in window) {
  const branchesBySection = new Map(branches.map(branch => [branch.parentElement, branch]));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const branch = branchesBySection.get(entry.target);
      if (entry.isIntersecting) visibleBranches.add(branch);
      else visibleBranches.delete(branch);
    });
    requestBranchUpdate();
  });
  branchesBySection.forEach((_, section) => observer.observe(section));
  window.addEventListener('scroll', requestBranchUpdate, { passive: true });
  window.addEventListener('resize', requestBranchUpdate);
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) levelAnimation?.cancel();
  else requestBranchUpdate();
});
