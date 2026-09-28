import { createApplicationAuthController, type ApplicationAuthScreenConfig } from '../core/application-auth-controller';
import { applicationAuthCopy } from '../core/application-auth-copy';

const config = JSON.parse(document.getElementById('application-auth-config')!.textContent!) as ApplicationAuthScreenConfig;
const copy = applicationAuthCopy[config.language] ?? applicationAuthCopy.en;
const form = document.getElementById('account-form') as HTMLFormElement;
const status = document.getElementById('account-status')!;
const email = document.getElementById('account-email') as HTMLInputElement;
const password = document.getElementById('account-password') as HTMLInputElement;
const confirm = document.getElementById('account-confirm') as HTMLInputElement;
const controls = [...form.querySelectorAll<HTMLButtonElement>('button')];
const rolePanel = document.getElementById('role-admin')!;
const identity = document.getElementById('account-identity')!;
const roleForm = document.getElementById('role-form') as HTMLFormElement;
const roleUser = document.getElementById('role-user') as HTMLInputElement;
const roleSelect = document.getElementById('role-select') as HTMLSelectElement;
const roleStatus = document.getElementById('role-status')!;
const roleButtons = [...roleForm.querySelectorAll<HTMLButtonElement>('button')];
try {
  const controller = createApplicationAuthController(config);
  let roleGeneration = 0;
  for (const role of config.roles ?? []) {
    const option = document.createElement('option');
    option.value = role.id; option.textContent = role.name;
    roleSelect.append(option);
  }
  const refreshRolePanel = async () => {
    const generation = ++roleGeneration;
    rolePanel.hidden = true;
    identity.hidden = true;
    if (!['signed-in', 'password-updated'].includes(controller.status().state)) return;
    try {
      const current = await controller.currentUserId();
      if (generation !== roleGeneration || !['signed-in', 'password-updated'].includes(controller.status().state)) return;
      document.getElementById('account-user-id')!.textContent = current;
      identity.hidden = false;
      if (!roleSelect.options.length) return;
      const { userId } = await controller.roleAdministration();
      if (generation !== roleGeneration || !['signed-in', 'password-updated'].includes(controller.status().state)) return;
      if (userId !== current) return;
      rolePanel.hidden = false;
    } catch { rolePanel.hidden = true; }
  };
  const render = (message?: string) => {
    const { state, busy } = controller.status();
    const recovery = state === 'recovery';
    const signedIn = state === 'signed-in' || state === 'password-updated';
    if (!signedIn) { roleGeneration++; rolePanel.hidden = true; identity.hidden = true; roleUser.value = ''; roleStatus.textContent = ''; }
    status.textContent = message ?? copy[state];
    form.setAttribute('aria-busy', String(busy));
    document.getElementById('email-field')!.hidden = recovery || signedIn;
    document.getElementById('password-field')!.hidden = signedIn;
    document.getElementById('confirm-field')!.hidden = !recovery;
    email.required = !recovery && !signedIn;
    password.required = !signedIn;
    password.autocomplete = recovery ? 'new-password' : 'current-password';
    password.minLength = recovery ? 8 : 1;
    confirm.required = recovery;
    controls.forEach(button => {
      const action = button.value;
      button.disabled = busy;
      button.hidden = action === 'update' ? !recovery : ['proceed', 'signOut'].includes(action) ? !signedIn
        : recovery || signedIn || (action === 'signUp' && !config.signUpEnabled);
    });
  };
  let working = false;
  const perform = async (action: string) => {
    if (working) return;
    if (action === 'update' && password.value !== confirm.value) { render(copy.mismatch); return; }
    working = true;
    roleGeneration++; rolePanel.hidden = true; identity.hidden = true;
    controls.forEach(button => { button.disabled = true; });
    status.textContent = copy.loading;
    form.setAttribute('aria-busy', 'true');
    try {
      if (action === 'signIn') await controller.signIn(email.value, password.value);
      else if (action === 'signUp') await controller.signUp(email.value, password.value);
      else if (action === 'reset') await controller.requestReset(email.value);
      else if (action === 'update') await controller.updatePassword(password.value);
      else if (action === 'signOut') await controller.signOut();
      else if (action === 'proceed') window.location.assign(await controller.prepareNavigation());
      render();
      if (['signIn', 'signUp', 'update'].includes(action)) void refreshRolePanel();
    } catch { render(copy.error); }
    finally { password.value = ''; confirm.value = ''; working = false; }
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    const button = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    void perform(button?.value ?? (controller.status().state === 'recovery' ? 'update' : 'signIn'));
  });
  roleForm.addEventListener('submit', event => {
    event.preventDefault();
    if (working || rolePanel.hidden || !roleForm.reportValidity()) return;
    const action = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (!action || !['grant', 'revoke'].includes(action.value)) return;
    working = true; roleButtons.forEach(button => { button.disabled = true; });
    roleStatus.textContent = copy.loading;
    void controller.setUserRole(roleUser.value, roleSelect.value, action.value === 'grant')
      .then(() => { roleStatus.textContent = copy.roleSaved; })
      .catch(() => { roleStatus.textContent = copy.roleError; rolePanel.hidden = true; })
      .finally(() => { working = false; roleButtons.forEach(button => { button.disabled = false; }); });
  });
  // Reset submits only the email address, without requiring a password.
  document.getElementById('account-reset')!.addEventListener('click', () => { if (email.reportValidity()) void perform('reset'); });
  window.addEventListener('pagehide', () => controller.dispose(), { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  working = true;
  controls.forEach(button => { button.disabled = true; });
  void controller.initialize().then(() => { render(); void refreshRolePanel(); }).catch(() => render(copy.error)).finally(() => { working = false; });
} catch {
  status.textContent = copy.unavailable;
  controls.forEach(button => { button.disabled = true; });
}
