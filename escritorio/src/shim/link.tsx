/** Sustituye a next/link: un enlace normal que navega por # */
import React from "react";

interface Props extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: React.ReactNode;
}

export default function Link({ href, children, ...resto }: Props) {
  return (
    <a href={"#" + (href.startsWith("/") ? href : "/" + href)} {...resto}>
      {children}
    </a>
  );
}
