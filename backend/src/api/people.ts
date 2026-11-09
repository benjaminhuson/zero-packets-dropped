// Section 5: people, sign-in and access between a new colleague, their line manager and their buddy.
//
//   1. The line manager (Entra) creates a Stride account for the new colleague and gets a one-time invite
//      code to pass on. Stride sends no email: the hackathon tenant must not email outside the tenant.
//   2. The colleague redeems the code, sets a password, and signs in with email + password.
//   3. Once IT creates their Entra account, the manager links its UPN. From the colleague's first Microsoft
//      sign-in, Stride uses Entra only and the Stride password stops working.
//   4. The manager and the buddy see the colleague in their list. The buddy sees less (see buddyView).
import type { Caller, Clock, Note, Relationship, StarterAccount, StarterState, StarterSummary, Store, UserId } from '../contracts.js';
import { HttpError } from './service.js';
import { hashPassword, newInviteCode, normaliseInvite, sha256, verifyPassword } from '../auth/crypto.js';

const INVITE_DAYS = 14;
const MIN_PASSWORD = 10;
const MAX_STATE_BYTES = 200 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

export interface StarterCard {
  id: UserId;
  name: string;
  relationship: Relationship;
  invitePending: boolean;
  upn: string | null;
  entraLinked: boolean;
  summary: StarterSummary | null;
}

export class PeopleService {
  // Simple in-process throttle for password sign-in: 5 failures per email per 15 minutes.
  private failures = new Map<string, { count: number; until: number }>();

  constructor(private readonly store: Store, private readonly clock: Clock) {}

  // ---- Caller checks -------------------------------------------------------------

  static starterId(caller: Caller | null): UserId {
    if (!caller) throw new HttpError(401, 'Sign in first');
    if (caller.kind !== 'starter') throw new HttpError(403, 'This is for the new colleague only');
    return caller.userId;
  }

  static staff(caller: Caller | null): { upn: string; name: string } {
    if (!caller) throw new HttpError(401, 'Sign in first');
    if (caller.kind !== 'staff') throw new HttpError(403, 'This is for line managers and buddies only');
    return caller;
  }

  private async relationship(caller: Caller | null, starterId: UserId): Promise<{ account: StarterAccount; rel: Relationship }> {
    const me = PeopleService.staff(caller);
    const account = await this.store.getStarter(starterId);
    // Same answer for "missing" and "not yours", so ids cannot be probed.
    if (account?.managerUpn === me.upn) return { account, rel: 'manager' };
    if (account && account.buddyUpn === me.upn) return { account, rel: 'buddy' };
    throw new HttpError(404, 'No such colleague in your list');
  }

  // ---- Manager: create and manage colleagues ------------------------------------------

  async createStarter(caller: Caller | null, input: { firstName: string; lastName: string; email: string; buddyUpn: string | null }) {
    const me = PeopleService.staff(caller);
    const firstName = input.firstName.trim();
    const email = input.email.trim().toLowerCase();
    if (!firstName) throw new HttpError(400, 'firstName is required');
    if (!EMAIL.test(email)) throw new HttpError(400, 'email must be an email address');
    if (await this.store.findStarterByEmail(email)) throw new HttpError(409, 'A colleague with this email already has a Stride account');
    const buddyUpn = this.cleanUpn(input.buddyUpn);
    if (buddyUpn === me.upn) throw new HttpError(400, 'The buddy must be someone other than the line manager');

    const code = newInviteCode();
    const now = this.clock.now();
    const account: StarterAccount = {
      id: newId('str'),
      firstName,
      lastName: input.lastName.trim(),
      email,
      passwordHash: null,
      inviteHash: sha256(code),
      inviteExpiresAt: new Date(now.getTime() + INVITE_DAYS * 86400000).toISOString(),
      managerUpn: me.upn,
      buddyUpn,
      upn: null,
      entraLinkedAt: null,
      createdAt: now.toISOString(),
    };
    await this.store.saveStarter(account);
    return { starter: await this.card(account, 'manager'), inviteCode: code, inviteExpiresAt: account.inviteExpiresAt };
  }

  // A fresh code, e.g. if the first one was lost. The old code stops working.
  async reissueInvite(caller: Caller | null, starterId: UserId) {
    const { account, rel } = await this.relationship(caller, starterId);
    if (rel !== 'manager') throw new HttpError(403, 'Only the line manager can do this');
    if (account.entraLinkedAt) throw new HttpError(409, 'This colleague now signs in with Microsoft');
    const code = newInviteCode();
    const inviteExpiresAt = new Date(this.clock.now().getTime() + INVITE_DAYS * 86400000).toISOString();
    await this.store.saveStarter({ ...account, inviteHash: sha256(code), inviteExpiresAt, passwordHash: null });
    return { inviteCode: code, inviteExpiresAt };
  }

  async setBuddy(caller: Caller | null, starterId: UserId, buddy: string | null) {
    const { account, rel } = await this.relationship(caller, starterId);
    if (rel !== 'manager') throw new HttpError(403, 'Only the line manager can do this');
    const buddyUpn = this.cleanUpn(buddy);
    if (buddyUpn === account.managerUpn) throw new HttpError(400, 'The buddy must be someone other than the line manager');
    const updated = { ...account, buddyUpn };
    await this.store.saveStarter(updated);
    return this.card(updated, 'manager');
  }

  // Link the colleague's new Entra account (the "line manager adds the UPN" step).
  async linkEntra(caller: Caller | null, starterId: UserId, upnInput: string) {
    const { account, rel } = await this.relationship(caller, starterId);
    if (rel !== 'manager') throw new HttpError(403, 'Only the line manager can do this');
    const upn = this.cleanUpn(upnInput);
    if (!upn) throw new HttpError(400, 'upn is required');
    if (upn === account.managerUpn || upn === account.buddyUpn) throw new HttpError(400, "That is the manager's or buddy's account, not the colleague's");
    const other = await this.store.findStarterByUpn(upn);
    if (other && other.id !== account.id) throw new HttpError(409, 'That account is already linked to another colleague');
    if (account.entraLinkedAt && account.upn !== upn) throw new HttpError(409, 'Already linked and in use; ask an admin to change it');
    const updated = { ...account, upn };
    await this.store.saveStarter(updated);
    return this.card(updated, 'manager');
  }

  async listMine(caller: Caller | null): Promise<StarterCard[]> {
    const me = PeopleService.staff(caller);
    const accounts = await this.store.listStartersForStaff(me.upn);
    const cards = await Promise.all(accounts.map((a) => this.card(a, a.managerUpn === me.upn ? 'manager' : 'buddy')));
    return cards.sort((a, b) => a.name.localeCompare(b.name));
  }

  async view(caller: Caller | null, starterId: UserId) {
    const { account, rel } = await this.relationship(caller, starterId);
    const card = await this.card(account, rel);
    const notes = await this.store.listNotes(starterId);
    if (rel === 'buddy') return { ...card, notes }; // where they are on the journey, and the shared thread
    return { ...card, email: account.email, buddyUpn: account.buddyUpn, inviteExpiresAt: account.inviteExpiresAt, notes };
  }

  // ---- Colleague: invite, password, session ---------------------------------------------

  async redeemInvite(code: string, password: string): Promise<StarterAccount> {
    if (password.length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
    const account = await this.store.findStarterByInvite(sha256(normaliseInvite(code)));
    if (!account || !account.inviteExpiresAt || account.inviteExpiresAt < this.clock.now().toISOString()) {
      throw new HttpError(400, 'That invite code is not valid or has expired. Ask your line manager for a new one.');
    }
    const updated: StarterAccount = { ...account, passwordHash: await hashPassword(password), inviteHash: null, inviteExpiresAt: null };
    await this.store.saveStarter(updated);
    return updated;
  }

  async signIn(emailInput: string, password: string): Promise<StarterAccount> {
    const email = emailInput.trim().toLowerCase();
    const now = this.clock.now().getTime();
    const f = this.failures.get(email);
    if (f && f.count >= 5 && f.until > now) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');

    const account = await this.store.findStarterByEmail(email);
    const ok = !!account?.passwordHash && (await verifyPassword(password, account.passwordHash));
    if (!ok || !account) {
      const next = f && f.until > now ? f.count + 1 : 1;
      this.failures.set(email, { count: next, until: now + 15 * 60000 });
      throw new HttpError(401, 'Email or password is wrong');
    }
    this.failures.delete(email);
    if (account.entraLinkedAt) throw new HttpError(409, 'Your Microsoft account is set up now. Use "Sign in with Microsoft".');
    return account;
  }

  async me(caller: Caller | null) {
    if (!caller) throw new HttpError(401, 'Sign in first');
    if (caller.kind === 'staff') {
      const cards = await this.listMine(caller);
      return { kind: 'staff' as const, name: caller.name, upn: caller.upn, starters: cards };
    }
    const account = await this.store.getStarter(caller.userId);
    return {
      kind: 'starter' as const,
      id: caller.userId,
      name: account?.firstName ?? caller.name,
      via: caller.via,
      entraLinkPending: !!account?.upn && !account.entraLinkedAt, // the Microsoft account is ready to use
    };
  }

  // ---- Colleague: saved app state ----------------------------------------------------------

  async saveState(caller: Caller | null, state: unknown, summary: unknown): Promise<StarterState> {
    const userId = PeopleService.starterId(caller);
    if (JSON.stringify(state ?? null).length > MAX_STATE_BYTES) throw new HttpError(413, 'State is too large');
    const saved: StarterState = { userId, savedAt: this.clock.now().toISOString(), state, summary: this.cleanSummary(summary) };
    await this.store.saveStarterState(saved);
    return saved;
  }

  async loadState(caller: Caller | null): Promise<StarterState | null> {
    return this.store.getStarterState(PeopleService.starterId(caller));
  }

  // ---- Shared thread -------------------------------------------------------------------------

  async starterNotes(caller: Caller | null): Promise<Note[]> {
    return this.store.listNotes(PeopleService.starterId(caller));
  }

  async postNote(caller: Caller | null, text: string, starterId?: UserId): Promise<Note> {
    const body = text.trim();
    if (!body || body.length > 2000) throw new HttpError(400, 'text must be 1-2000 characters');
    let note: Note;
    if (caller?.kind === 'starter') {
      note = { id: newId('note'), starterId: caller.userId, from: 'starter', fromName: caller.name, text: body, sentAt: this.clock.now().toISOString() };
    } else {
      if (!starterId) throw new HttpError(400, 'starterId is required');
      const { rel } = await this.relationship(caller, starterId);
      const me = PeopleService.staff(caller);
      note = { id: newId('note'), starterId, from: rel, fromName: me.name, text: body, sentAt: this.clock.now().toISOString() };
    }
    await this.store.appendNote(note);
    return note;
  }

  // ---- Internals ------------------------------------------------------------------------------

  private cleanUpn(value: string | null | undefined): string | null {
    const v = (value ?? '').trim().toLowerCase();
    if (!v) return null;
    if (!EMAIL.test(v)) throw new HttpError(400, `"${value}" is not a UPN (name@domain)`);
    return v;
  }

  private cleanSummary(raw: unknown): StarterSummary {
    const s = (raw ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
    return {
      stage: num(s.stage),
      stageName: typeof s.stageName === 'string' ? s.stageName.slice(0, 80) : '',
      stagesTotal: num(s.stagesTotal),
      stepsDone: num(s.stepsDone),
      startDate: typeof s.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.startDate) ? s.startDate : null,
    };
  }

  private async card(account: StarterAccount, relationship: Relationship): Promise<StarterCard> {
    const saved = await this.store.getStarterState(account.id);
    return {
      id: account.id,
      name: `${account.firstName} ${account.lastName}`.trim(),
      relationship,
      invitePending: !account.passwordHash && !account.entraLinkedAt,
      upn: account.upn,
      entraLinked: !!account.entraLinkedAt,
      summary: saved?.summary ?? null,
    };
  }
}
