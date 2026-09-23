import {
  splitTypographyProps,
  usePageTypography,
  type PageTypographyProps,
} from "./pageTypography";
import { LandingPageFrame, type LandingPageFrameProps, type LandingPageProps } from "./LandingPageFrame";
export { LandingPageFrame, applyBackgroundPresentation } from "./LandingPageFrame";
export type { LandingPageFrameProps, LandingPageProps } from "./LandingPageFrame";
import { BESTSELLERS_TYPOGRAPHY, COMPLETE_SHELF_TYPOGRAPHY } from "./pageRecipes";

/*
 * Trimmed from the registered `LandingPages.tsx` (SHA-256 4d379461ad00eb4d…),
 * which is the whole landing-page family in one module and pulls in a dozen
 * sibling scenes that ship outside this bundle. The two components below are
 * reproduced verbatim; every other export in that file belongs to a page this
 * project does not use.
 */

export function CompleteShelfLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(COMPLETE_SHELF_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Working Volumes — Seven Tools for Making" sourceUrl="/landing-pages/complete-shelf-v2.html" />;
}

export function BestsellersBookShowcase(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(BESTSELLERS_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Field Manuals — Tools for Thought" sourceUrl="/landing-pages/bestsellers-book-showcase.html" />;
}

/*
 * `LandingPageProps` deliberately omits `sourceUrl`, because the registered
 * components always load their packaged document. These two are the same pages
 * with that one prop opened up, so a derived document — the packaged file with
 * the reader's own entries substituted in — can be loaded through the same
 * frame and the same typography contract.
 */

/** Frame props with the derived document's own title supplied by the wrapper. */
export type DiaryPageProps = Omit<LandingPageFrameProps, "title"> & PageTypographyProps;

export function DiaryShelfPage({ sourceUrl, ...props }: DiaryPageProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(COMPLETE_SHELF_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Rak catatan" sourceUrl={sourceUrl} />;
}

export function DiaryManualPage({ sourceUrl, ...props }: DiaryPageProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(BESTSELLERS_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Pembaca catatan" sourceUrl={sourceUrl} />;
}
