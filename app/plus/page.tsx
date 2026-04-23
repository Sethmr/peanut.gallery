import { redirect } from "next/navigation";

// The marketing landing for Peanut Gallery Plus lives on the static
// GitHub Pages site (peanut.gallery.site repo). Backend traffic that
// hits /plus here just bounces there. Keeps both the extension's
// success_url and any marketing deep links landing on a real page.
export default function PlusRedirect(): never {
  redirect("https://www.peanutgallery.live/plus");
}
