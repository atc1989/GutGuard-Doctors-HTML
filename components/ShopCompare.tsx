"use client";

import { useEffect } from "react";

// "Why this price? Compare" - sheet + full comparison page from the boss's Full Protocol mockup
// (13 October 2026). Copy and competitor data are the mockup's; only our price-per-capsule
// range is live (passed in). Styles: .shop-compare* / .shop-fullcompare* in globals.css.

const Check = () => (
  <svg
    className="check-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-label="Yes"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Arrow = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const No = ({ note }: { note?: string }) => (
  <td className="no">
    ✕{note ? <small>{note}</small> : null}
  </td>
);

/** Closes on Escape, like the shop's other sheets. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export function CompareSheet({
  rateRange,
  onClose,
  onFull,
}: {
  rateRange: string;
  onClose: () => void;
  onFull: () => void;
}) {
  useEscape(onClose);
  return (
    <div className="shop-modal-wrap" role="presentation">
      <button className="shop-drawer-scrim" type="button" aria-label="Close comparison" onClick={onClose} />
      <section className="shop-modal shop-compare-sheet" role="dialog" aria-modal="true" aria-labelledby="shop-compare-title">
        <div className="shop-drawer-head">
          <div>
            <p className="shop-kicker">Compare</p>
            <h2 id="shop-compare-title">Not all probiotics are the same.</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="shop-compare">
          <p className="shop-compare-sub">
            One capsule of SynBIOTIC+ gives you 7 benefits. Most drugstore probiotics give you 0 or 1.
          </p>
          <table className="shop-compare-table">
            <thead>
              <tr>
                <th scope="col">Benefit</th>
                <th scope="col">Typical drugstore probiotic</th>
                <th scope="col" className="ours">
                  SynBIOTIC+
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Complete synbiotic (prebiotic + probiotic + postbiotic)</th>
                <No />
                <td className="ours"><Check /></td>
              </tr>
              <tr>
                <th scope="row">Live count tested by a third-party lab</th>
                <No note="label only" />
                <td className="ours"><Check /></td>
              </tr>
              <tr>
                <th scope="row">Number of strains</th>
                <td>1–5</td>
                <td className="ours">17</td>
              </tr>
              <tr>
                <th scope="row">Gut–brain support (L-Tryptophan)</th>
                <No />
                <td className="ours"><Check /></td>
              </tr>
              <tr>
                <th scope="row">Cell energy support (Urolithin-A)</th>
                <No />
                <td className="ours"><Check /></td>
              </tr>
              <tr>
                <th scope="row">Reaches the gut alive</th>
                <td>Some</td>
                <td className="ours"><Check /></td>
              </tr>
              <tr>
                <th scope="row">Antioxidants (Glutathione, lutein)</th>
                <No />
                <td className="ours"><Check /></td>
              </tr>
              <tr className="total">
                <th scope="row">Total benefits</th>
                <td>0–1 of 7</td>
                <td className="ours">7 of 7</td>
              </tr>
              <tr className="price">
                <th scope="row">Price per capsule</th>
                <td>₱37–₱90</td>
                <td className="ours">{rateRange}</td>
              </tr>
            </tbody>
          </table>
          <p className="shop-compare-foot">
            Based on public labels and retail prices of 5 common probiotics in Philippine drugstores, October 2026.
          </p>
          <button type="button" className="shop-primary shop-compare-full" onClick={onFull}>
            <span>See full comparison</span>
            <Arrow />
          </button>
          <button type="button" className="shop-secondary shop-compare-back" onClick={onClose}>
            Back to packages
          </button>
        </div>
      </section>
    </div>
  );
}

const COMPETITORS = [
  { name: "Product V", type: "Single strain · drops, powder, chewable" },
  { name: "Product W", type: "Women's probiotic capsule" },
  { name: "Product X", type: "Women's probiotic capsule" },
  { name: "Product Y", type: "Spore suspension" },
  { name: "Product Z", type: "Spore suspension" },
];

export function FullCompare({ rateRange, onClose }: { rateRange: string; onClose: () => void }) {
  useEscape(onClose);
  // The page covers the shop; stop the page behind it from scrolling.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const noRow = (note?: string) => COMPETITORS.map((c) => <No key={c.name} note={note} />);

  return (
    <div className="shop-fullcompare" role="dialog" aria-modal="true" aria-labelledby="shop-fullcompare-title">
      <div className="shop-fullcompare-inner">
        <div className="shop-drawer-head">
          <div>
            <p className="shop-kicker">Compare before you choose</p>
            <h2 id="shop-fullcompare-title">
              Not all probiotics are the same. <em>Compare.</em>
            </h2>
          </div>
          <button type="button" className="shop-compare-back" onClick={onClose}>
            Back to packages
          </button>
        </div>
        <p className="shop-compare-sub">
          Here are <b>5 of the most common probiotics</b> in drugstores today. Most give you one thing: a few good
          bacteria. One capsule of <b>Gutguard SynBIOTIC+</b> gives you everything below.
        </p>

        <div className="shop-fullcompare-features">
          <article className="lead">
            <p className="shop-kicker">
              01 · Synbiotic<em>#1 Advantage</em>
            </p>
            <strong>Pre + pro + postbiotics in one</strong>
            <p>
              Prebiotic fibre feeds the good bacteria, 17 probiotic strains add more, and postbiotics help your gut.
              Most probiotics give you only the bacteria.
            </p>
          </article>
          <article>
            <p className="shop-kicker">02 · Gut–brain</p>
            <strong>Supports your gut–brain link</strong>
            <p>
              With <b>L-Tryptophan</b>, the building block your body uses to make serotonin. About 90% of serotonin is
              made in the gut.
            </p>
          </article>
          <article>
            <p className="shop-kicker">03 · Cell energy</p>
            <strong>Supports cell energy</strong>
            <p>
              With <b>Urolithin-A</b>, for mitochondrial health. Only about 4 in 10 adults can make it from food on
              their own.
            </p>
          </article>
        </div>

        <div className="shop-trust-grid shop-fullcompare-facts">
          <article>
            <div>
              <strong>240B</strong>
              <span>CFU / gram</span>
            </div>
            <p>
              <b>What is CFU?</b> Colony-forming units: the number of <b>live</b> good bacteria that can grow and work in
              your gut. Only live bacteria can help, and counts can drop over time. SynBIOTIC+ was tested by a{" "}
              <b>third-party lab</b>, so you know what is really inside.
            </p>
          </article>
          <article>
            <div>
              <strong>17</strong>
              <span>strains</span>
            </div>
            <p>
              <b>Why many strains?</b> Each strain has its own job. Some help break down food, some support the gut
              lining, some support your natural defenses. More kinds of good bacteria means a more <b>diverse gut</b>,
              and a diverse gut is linked to better health.
            </p>
          </article>
        </div>

        <div className="shop-card shop-fullcompare-card">
          <div className="shop-fullcompare-scroll" tabIndex={0} aria-label="Comparison table. Scroll sideways to see every product.">
            <table className="shop-compare-table shop-fullcompare-table">
              <thead>
                <tr>
                  <th scope="col">Benefit</th>
                  {COMPETITORS.map((c) => (
                    <th scope="col" key={c.name}>
                      {c.name}
                      <small>{c.type}</small>
                    </th>
                  ))}
                  <th scope="col" className="ours">
                    SynBIOTIC+<small>by Gutguard</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="star">
                  <th scope="row">
                    <span>★ Complete synbiotic formula</span>
                    <small>Prebiotic + probiotic + postbiotic</small>
                  </th>
                  {noRow()}
                  <td className="ours yes"><Check /></td>
                </tr>
                <tr className="star">
                  <th scope="row">
                    <span>★ Live count tested by a third-party lab</span>
                  </th>
                  {noRow("label only")}
                  <td className="ours yes"><Check /></td>
                </tr>
                <tr className="star">
                  <th scope="row">
                    <span>★ Number of strains</span>
                    <small>More strains, more jobs covered</small>
                  </th>
                  <td>1</td>
                  <td>Not stated</td>
                  <td>5</td>
                  <td>1</td>
                  <td>4</td>
                  <td className="ours">17</td>
                </tr>
                <tr className="star">
                  <th scope="row">
                    <span>★ Gut–brain support</span>
                    <small>With L-Tryptophan</small>
                  </th>
                  {noRow()}
                  <td className="ours yes"><Check /></td>
                </tr>
                <tr className="star">
                  <th scope="row">
                    <span>★ Cell energy support</span>
                    <small>With Urolithin-A</small>
                  </th>
                  {noRow()}
                  <td className="ours yes"><Check /></td>
                </tr>
                <tr>
                  <th scope="row">
                    <span>Reaches the gut alive</span>
                    <small>Built to survive stomach acid</small>
                  </th>
                  <No />
                  <No />
                  <No />
                  <td className="part"><Check /></td>
                  <td className="part"><Check /></td>
                  <td className="ours yes"><Check /></td>
                </tr>
                <tr>
                  <th scope="row">
                    <span>Antioxidants</span>
                    <small>Glutathione and lutein</small>
                  </th>
                  {noRow()}
                  <td className="ours yes"><Check /></td>
                </tr>
                <tr className="price">
                  <th scope="row">
                    <span>Price per dose</span>
                    <small>One capsule, every benefit above</small>
                  </th>
                  <td>₱37.00</td>
                  <td>Not published</td>
                  <td>₱54.00</td>
                  <td>₱38.00</td>
                  <td>₱89.60</td>
                  <td className="ours">{rateRange}</td>
                </tr>
                <tr className="total">
                  <th scope="row">
                    <span>Total benefits</span>
                  </th>
                  <td>0 of 7</td>
                  <td>0 of 7</td>
                  <td>0 of 7</td>
                  <td>1 of 7</td>
                  <td>1 of 7</td>
                  <td className="ours">7 of 7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="shop-compare-foot">
          Products V to Z are probiotics sold in Philippine drugstores. Based on public labels and retail prices, October
          2026. Label counts and prices are per tablet, capsule or bottle.
        </p>
        <p className="shop-compare-foot shop-fullcompare-legal">
          FDA-registered food supplement · CPR No. FR-40000015571456 · No approved therapeutic claims. This is not a
          medicine and is not intended to diagnose, treat, cure or prevent any disease. Consult your doctor if you are
          pregnant, nursing, taking medication or have a medical condition.
        </p>
        <button type="button" className="shop-secondary shop-compare-back wide" onClick={onClose}>
          Back to packages
        </button>
      </div>
    </div>
  );
}
