// Demo fixture for `a11y-ci lint`. The authoring linter flags the issues below
// straight from this source, with no render. The lines marked GOOD are correct
// and the linter deliberately stays silent on them.

export function Signup() {
  return (
    <main>
      <h1>Newsletter signup</h1>

      {/* img-alt (1.1.1): no alt */}
      <img src="logo.png" width={80} height={80} />
      {/* GOOD: described image is fine */}
      <img src="hero.png" alt="People reading a newsletter" />

      {/* clickable-noninteractive (2.1.1): a div pretending to be a button */}
      <div onClick={() => openMenu()}>Menu</div>
      {/* GOOD: a real, keyboard-operable custom control */}
      <div role="button" tabIndex={0} onClick={() => openMenu()} onKeyDown={onKey}>
        Menu
      </div>

      <form>
        {/* input-label (1.3.1): no id, no label, no aria-label */}
        <input type="email" placeholder="Email address" />
        {/* GOOD: wrapped in a label */}
        <label>
          Name <input type="text" />
        </label>

        {/* interactive-name (4.1.2): button with no accessible name */}
        <button onClick={() => submit()} />
        {/* GOOD */}
        <button onClick={() => submit()}>Subscribe</button>
      </form>

      {/* vague-link-text (2.4.4) */}
      <a href="/pricing">click here</a>
      {/* GOOD */}
      <a href="/pricing">See our pricing plans</a>

      {/* positive-tabindex (2.4.3) */}
      <nav tabIndex={2}>...</nav>
    </main>
  );
}
