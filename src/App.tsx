/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import PromptJudge from './components/PromptJudge';

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <PromptJudge />
    </div>
  );
}
