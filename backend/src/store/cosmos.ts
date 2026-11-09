// Section 2 (Azure): Cosmos DB store. Not implemented yet.
// Plan: one container per type (journeys, messages, checkIns, chat), partition key = userId.
// Use managed identity (DefaultAzureCredential). Endpoint comes from the environment, never from code.
import type { ChatTurn, CheckInRequest, Journey, Store, TeamsMessage, UserId } from '../contracts.js';

export class CosmosStore implements Store {
  constructor(private readonly endpoint: string) {}

  private todo(): never {
    throw new Error(`CosmosStore is not implemented yet (endpoint configured: ${this.endpoint ? 'yes' : 'no'})`);
  }

  getJourney(_userId: UserId): Promise<Journey | null> { return this.todo(); }
  saveJourney(_journey: Journey): Promise<void> { return this.todo(); }
  listUserIds(): Promise<UserId[]> { return this.todo(); }
  appendMessage(_message: TeamsMessage): Promise<void> { return this.todo(); }
  listMessages(_userId: UserId): Promise<TeamsMessage[]> { return this.todo(); }
  addCheckIn(_checkIn: CheckInRequest): Promise<void> { return this.todo(); }
  listCheckIns(_userId: UserId): Promise<CheckInRequest[]> { return this.todo(); }
  appendChat(_turn: ChatTurn): Promise<void> { return this.todo(); }
  listChat(_userId: UserId): Promise<ChatTurn[]> { return this.todo(); }
}
