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
      <PromptJudge />
    </div>
  );
}
