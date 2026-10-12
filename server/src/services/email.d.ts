export function scheduleEmailNotification(
  name: string,
  send: () => Promise<void>,
): void;

export function sendConfirmationEmail(input: {
  email: string;
  fullName: string;
  code: string;
}): Promise<void>;

export function sendReadyForPickupEmail(input: {
  email: string;
  fullName: string;
  documentName: string;
  requestCode: string;
}): Promise<void>;

export function sendRequestCommentEmail(input: {
  email: string;
  fullName: string;
  documentName: string;
  requestCode: string;
}): Promise<void>;
