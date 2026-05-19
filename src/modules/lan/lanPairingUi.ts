/** Pending LAN pairing request shown in the header banner / confirm dialog. */
export type LanPendingDetail = {
  token: string;
  remoteDeviceId: string;
  remoteName: string;
  remoteAppVersion?: string;
  remoteAddress?: string;
};
