// The mechanism explanation (section 5.4) stays on every technique card, folded under one line so
// the steps come first. Text is unchanged.
export default function ProtocolWhy({ text }: { text: string }) {
  return (
    <details className="protocol-why">
      <summary>Почему это может помочь</summary>
      <p className="protocol-note">{text}</p>
    </details>
  );
}
