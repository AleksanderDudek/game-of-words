export interface JoinScreenProps {
  connected: boolean;
  nameInput: string;
  sessionIdInput: string;
  onNameChange: (value: string) => void;
  onSessionIdChange: (value: string) => void;
  onJoin: () => void;
}
