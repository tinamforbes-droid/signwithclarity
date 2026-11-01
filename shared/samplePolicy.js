// A fictional policy, long enough to stand in for a real one in tests.
// It is not wording from any insurer.

export const END_EXCLUSION =
  "EXCLUSION AT THE END: volcanic glass shed collapse is excluded unless building 7 is listed on the declarations.";

export const OPENING_MARKER =
  "DECLARATION MARKER ALPHA: the named insured is Rowan Hale of Calgary.";

export const MIDPOINT_MARKER =
  "MIDPOINT MARKER: water backup is covered only when the endorsement is listed, and only up to the sublimit on the declarations.";

const FILLER =
  "The insurer agrees to cover sudden and accidental direct physical loss to the dwelling, subject to the limits written on the declarations and the conditions in this wording. A deductible applies to each occurrence. The insured must give prompt notice of a loss, protect the property from further damage, and show the damaged property if asked. Payment is limited to the actual cash value until repair or replacement is complete, unless the declarations say otherwise. ";

export function buildSamplePolicy({ pages = 28 } = {}) {
  const blocks = [];
  blocks.push(
    `${OPENING_MARKER} This is a fictional sample home policy used to test Sign With Clarity. It is not a real insurance contract. The policy period, limits, and deductible are those shown on the declarations page for the Calgary dwelling.`
  );

  const count = Math.max(1, pages);
  const middle = Math.ceil(count / 2);
  for (let page = 1; page <= count; page++) {
    let body = `Page ${page} of this sample policy. Section ${page} discusses coverage part ${page}. `;
    while (body.length < 3000) body += FILLER;
    body = body.slice(0, 3000);
    if (page === middle) body += ` ${MIDPOINT_MARKER}`;
    blocks.push(body);
  }

  blocks.push(
    `${END_EXCLUSION} This closing section also defines Clarity Deductible as the amount Rowan pays before a volcanic-glass claim, which is separate from the ordinary deductible. No coverage is granted by this sentence for any other cause of loss.`
  );

  return blocks.join("\n\n");
}
