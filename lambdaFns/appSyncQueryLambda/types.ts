export type NewPerson = {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

export type EventBridgeReponse = {
  result: {
    Entries: Array<{ EventId: string }>;
    FailedEntryCount: number;
  };
};
