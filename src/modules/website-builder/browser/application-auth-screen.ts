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
try {
  const controller = createApplicationAuthController(config);
  const render = (message?: string) => {
    const { state, busy } = controller.status();
    const recovery = state === 'recovery';
    const signedIn = state === 'signed-in' || state === 'password-updated';
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
    } catch { render(copy.error); }
    finally { password.value = ''; confirm.value = ''; working = false; }
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    const button = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    void perform(button?.value ?? (controller.status().state === 'recovery' ? 'update' : 'signIn'));
  });
  // Reset submits only the email address, without requiring a password.
  document.getElementById('account-reset')!.addEventListener('click', () => { if (email.reportValidity()) void perform('reset'); });
  window.addEventListener('pagehide', () => controller.dispose(), { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  working = true;
  controls.forEach(button => { button.disabled = true; });
  void controller.initialize().then(() => render()).catch(() => render(copy.error)).finally(() => { working = false; });
} catch {
  status.textContent = copy.unavailable;
  controls.forEach(button => { button.disabled = true; });
}
