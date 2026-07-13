import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

interface FormModalFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  saving?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
}

export function FormModalFooter({
  onCancel,
  onSubmit,
  saving = false,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  disabled = false,
}: FormModalFooterProps) {
  return (
    <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 pt-4 sm:justify-end">
      <Button
        type="button"
        variant="secondary"
        onClick={onCancel}
        disabled={saving}
      >
        {cancelLabel}
      </Button>
      <Button
        type="button"
        variant="default"
        onClick={onSubmit}
        disabled={saving || disabled}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </DialogFooter>
  );
}
