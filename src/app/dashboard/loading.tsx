import { LoadingPage } from "@/components/shared/LoadingPage"

// The loading boundary lives in the signed-in areas, not at the root: a root boundary
// streams every page, so a public notFound() (unknown event, org or enterprise) would be
// sent with status 200 instead of 404.
export default function Loading() {
  return <LoadingPage />
}
