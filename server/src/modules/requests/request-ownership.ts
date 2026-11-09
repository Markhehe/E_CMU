export function canUpdateAssignedRequest(
  assignedTo: number | string | null | undefined,
  _status: string,
  userId: number,
  isRegistrarAdmin: boolean,
) {
  return isRegistrarAdmin
    || assignedTo == null
    || Number(assignedTo) === userId;
}
