import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';

const ROUTINE_COOLDOWN_MS = 200;
const PROTECTED_ACTION_COOLDOWN_MS = 5000;
const ACTION_SELECTOR =
  'button, a, input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], [role="button"], [role="tab"], summary, tr.request-row-clickable';

function ActionCooldown() {
  const lastActions = useRef(new Map());
  const controlValues = useRef(new WeakMap());
  const submitClicks = useRef(new WeakMap());
  const { addToast } = useToast();

  const getActionKey = (element) => {
    const row = element.closest('tr');
    const form = element.closest('form');
    const actionContext = element.closest('[data-action-context]')?.getAttribute('data-action-context');
    const context = actionContext ||
      row?.querySelector('td')?.innerText.trim() ||
      form?.innerText.trim() ||
      element.closest('[role="dialog"], .modal')?.innerText.trim() ||
      '';
    const selectLabel = element instanceof HTMLSelectElement
      ? Array.from(element.options, (option) => option.textContent).join('|')
      : '';
    const actionLabel = (
      element.getAttribute('aria-label') ||
      element.id ||
      element.name ||
      selectLabel ||
      element.innerText ||
      element.value ||
      element.tagName
    ).trim();
    return `${context}|${actionLabel}`;
  };

  const checkCooldown = useCallback((element, useProtectedCooldown) => {
    const key = getActionKey(element);
    const now = Date.now();
    const lastAction = lastActions.current.get(key);
    const isProtected = useProtectedCooldown ??
      Boolean(element.closest('[data-action-cooldown="protected"]'));
    const cooldownMs = isProtected
      ? PROTECTED_ACTION_COOLDOWN_MS
      : ROUTINE_COOLDOWN_MS;

    if (lastAction && now - lastAction.timestamp < cooldownMs) {
      addToast('Slow down a bit—this action is cooling down.', 'info');
      return false;
    }

    lastActions.current.delete(key);
    lastActions.current.set(key, { timestamp: now });
    if (lastActions.current.size > 500) {
      const oldestKey = lastActions.current.keys().next().value;
      if (oldestKey !== undefined) lastActions.current.delete(oldestKey);
    }
    return true;
  }, [addToast]);

  useEffect(() => {
    const handleAction = (event, selector) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const action = target.closest(selector);
      if (!action || action.matches(':disabled')) return;

      if (!checkCooldown(action)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (
        action instanceof HTMLButtonElement &&
        action.type === 'submit'
      ) {
        submitClicks.current.set(action, Date.now());
      }
    };

    const handleClick = (event) => handleAction(event, ACTION_SELECTOR);
    const rememberControlValue = (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement) {
        controlValues.current.set(target, target.value);
      }
    };
    const handleChange = (event) => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement)) return;
      if (!checkCooldown(select, false)) {
        const previousValue = controlValues.current.get(select);
        if (previousValue !== undefined) select.value = previousValue;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      controlValues.current.set(select, select.value);
    };
    const handleSubmit = (event) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      const submitter = event.submitter instanceof Element ? event.submitter : event.target;
      const clickedAt = submitter instanceof HTMLButtonElement
        ? submitClicks.current.get(submitter)
        : undefined;
      if (clickedAt && Date.now() - clickedAt < 500) {
        submitClicks.current.delete(submitter);
        return;
      }
      if (!checkCooldown(submitter)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('focusin', rememberControlValue, true);
    document.addEventListener('pointerdown', rememberControlValue, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('submit', handleSubmit, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('focusin', rememberControlValue, true);
      document.removeEventListener('pointerdown', rememberControlValue, true);
      document.removeEventListener('change', handleChange, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, [checkCooldown]);

  return null;
}

export default ActionCooldown;
