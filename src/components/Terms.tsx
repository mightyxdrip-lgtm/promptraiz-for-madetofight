import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function Terms() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mb-4 text-xs text-foreground/60 underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4" aria-haspopup="dialog">
      Terms &amp; Conditions
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Terms &amp; Conditions</DialogTitle>
          <DialogDescription>Using Promptraitz · Usage and privacy information · Updated September 8, 2026</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <section><h3 className="mb-1 font-medium text-foreground">About the service</h3><p>Promptraitz helps you evaluate, improve, and generate prompts. AI-generated results and scores may be incomplete or inaccurate. Review results before using them.</p></section>
          <section><h3 className="mb-1 font-medium text-foreground">Responsible use</h3><p>Only submit content you have permission to use. Do not use the service for unlawful or harmful activity. Avoid entering passwords, personal information, or confidential material.</p></section>
          <section><h3 className="mb-1 font-medium text-foreground">What we save</h3><p>Your public IP address, submitted prompts, attached text, generated results, submission time, and processing duration are saved privately in Supabase so the site owner can understand usage and improve Promptraitz. The password-protected admin panel groups this history by public IP. A shared network may include multiple devices.</p></section>
          <section><h3 className="mb-1 font-medium text-foreground">Images and AI processing</h3><p>Submitted text and images may be sent to Groq to produce results. Uploaded images are not retained in our usage history; generated image-to-prompt text and analysis are saved. Local fallback results may also be saved.</p></section>
          <section><h3 className="mb-1 font-medium text-foreground">Access and retention</h3><p>Usage history is restricted to the site owner through the admin panel and authorized database access. Records remain until the owner deletes them; there is no automatic expiry. Logging may be unavailable when storage or service limits are reached.</p></section>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
