type FormNoticeDialogProps = {
  open: boolean;
  title: string;
  message: string;
  variant?: "error" | "success" | "info";
  confirmLabel?: string;
  onClose: () => void;
};

export function FormNoticeDialog({
  open,
  title,
  message,
  variant = "info",
  confirmLabel = "OK",
  onClose
}: FormNoticeDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="crm-modal-backdrop crm-notice-backdrop" role="presentation">
      <section
        aria-labelledby="crm-notice-title"
        aria-modal="true"
        className={`crm-modal crm-notice-dialog crm-notice-dialog-${variant}`}
        role="alertdialog"
      >
        <div className="crm-notice-header">
          <h3 id="crm-notice-title">{title}</h3>
        </div>
        <div className="crm-notice-body">
          {message.split("\n").map((line, index) =>
            line.trim() === "" ? <br key={`gap-${index}`} /> : <p key={`${line}-${index}`}>{line}</p>
          )}
        </div>
        <div className="crm-notice-actions">
          <button className="crm-primary-button crm-fit-button" onClick={onClose} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
