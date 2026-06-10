'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export function CopyButton({
  label = 'Sao chép',
  value,
}: {
  label?: string;
  value?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !value || copied;

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={disabled}
      className="border-white/10 text-slate-300"
      aria-label={label}
    >
      {copied ? <Check className="h-4 w-4 text-green-300" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Đã sao chép' : label}
    </Button>
  );
}
