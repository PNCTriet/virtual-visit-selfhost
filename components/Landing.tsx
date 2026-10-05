"use client";

import { useState } from "react";
import { VirtualVisitForm } from "./VirtualVisitForm";
import { MacPreview } from "./MacPreview";

export function Landing({ initialRoom }: { initialRoom?: string }) {
  const [name, setName] = useState("");
  return (
    <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-20">
      <div className="text-center lg:text-left">
        <h1 className="vv-hero vv-in" style={{ "--d": 0 } as React.CSSProperties}>
          Virtual <span className="vv-mark">Visit</span>
        </h1>
        <p className="vv-lead vv-in mx-auto mt-6 max-w-[28ch] text-muted lg:mx-0" style={{ "--d": 1 } as React.CSSProperties}>
          Walk around our space and meet other visitors, live.
        </p>
        <div className="vv-in mx-auto mt-12 max-w-[560px] text-left lg:mx-0 lg:mt-14" style={{ "--d": 2 } as React.CSSProperties}>
          <VirtualVisitForm name={name} onNameChange={setName} initialRoom={initialRoom} />
        </div>
      </div>
      <div className="vv-in" style={{ "--d": 3 } as React.CSSProperties}>
        <MacPreview />
      </div>
    </div>
  );
}
