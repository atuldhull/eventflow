import { NotFoundView } from "../_system/NotFoundView"

/** 404 inside the public site's navbar and footer (unknown organization, enterprise, ...). */
export default function PublicNotFound() {
  return <NotFoundView message="This page doesn't exist, or the organization behind it is no longer on EventFlow." />
}
