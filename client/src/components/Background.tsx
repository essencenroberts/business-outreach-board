/** Faint neon-pastel glow behind the glass, kept subtle so content stays calm. */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div className="blob absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-pink-200/45 blur-[110px]" />
      <div className="blob absolute right-[-12rem] top-[18%] h-[32rem] w-[32rem] rounded-full bg-lime-200/40 blur-[110px] [animation-delay:-8s]" />
      <div className="blob absolute bottom-[-14rem] left-[35%] h-[30rem] w-[30rem] rounded-full bg-orange-200/35 blur-[110px] [animation-delay:-16s]" />
      <div className="blob absolute bottom-[10%] left-[-8rem] h-[20rem] w-[20rem] rounded-full bg-yellow-200/45 blur-[100px] [animation-delay:-4s]" />
    </div>
  );
}
