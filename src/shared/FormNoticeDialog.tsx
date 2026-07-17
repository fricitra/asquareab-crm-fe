import { useModalEscape } from "../hooks/useModalEscape";

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
  useModalEscape(open, onClose);

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
          {message.split("\n").map((line, index) => {
            if (line.trim() === "") {
              return <br key={`gap-${index}`} />;
            }

            if (line.trimStart().startsWith("•")) {
              return (
                <p className="crm-notice-bullet" key={`${line}-${index}`}>
                  {line.trimStart()}
                </p>
              );
            }

            return <p key={`${line}-${index}`}>{line}</p>;
          })}
        </div>
        <div className="crm-notice-actions">
          <button autoFocus className="crm-primary-button crm-fit-button" onClick={onClose} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
