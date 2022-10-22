export enum DocumentDeliveryStatus {
  TO_BE_REVIEWED = 'TO_BE_REVIEWED', // this dr has received a dd, waiting decision
  UPDATE_REQUIRED = 'UPDATE_REQUIRED', //	the dd has been rejected and waits for an update
  ACCEPTED = 'ACCEPTED', //	the dd is definitely accepted
  REJECTED = 'REJECTED', //	the dd is definitely rejected
  DROPPED = 'DROPPED', //	the dd should not be reviewed, as it was cancelled by document issuer
}

export function getDocumentDeliveryStatuses(): Record<string, string> {
  const result = {};
  Object.entries(DocumentDeliveryStatus).map(([key, value]) => Object.assign(result, { [key]: value }));
  return result;
}
