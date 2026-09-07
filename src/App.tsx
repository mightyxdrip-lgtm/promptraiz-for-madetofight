/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Admin from './components/Admin';
import PromptJudge from './components/PromptJudge';

export default function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/admin') return <Admin />;
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <p className="border-b border-border px-4 py-3 text-center text-sm text-muted-foreground">
        Your public IP address, submitted prompts, attached text, and results are saved privately for the site owner to improve Promptraitz.
        Please avoid personal or confidential information. Uploaded images are not saved in the usage history.
      </p>
      <PromptJudge />
    </div>
  );
}
