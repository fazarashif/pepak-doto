"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/lib/auth/actions";

export function DeleteAccount() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className="grid gap-3 rounded-lg border border-danger/30 p-5">
      <div className="grid gap-1">
        <h3 className="font-medium">Delete account</h3>
        <p className="text-sm text-muted">
          Removes your profile and preferences from Pepak Doto. Your Steam account and match history
          are not affected.
        </p>
      </div>
      <Button variant="danger" className="w-fit" onClick={() => dialog.current?.showModal()}>
        Delete account
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border border-border bg-surface p-6 text-fg shadow-3 backdrop:bg-black/60"
      >
        <h2 id="delete-title" className="font-display text-lg font-bold">
          Delete your account?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This can&apos;t be undone. You can sign in again later, but your saved preferences will be
          gone.
        </p>
        <form action={deleteAccount} className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          <ConfirmButton />
        </form>
      </dialog>
    </div>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Deleting..." : "Yes, delete"}
    </Button>
  );
}
