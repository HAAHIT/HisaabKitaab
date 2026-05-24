declare module "html2pdf.js" {
  interface Html2PdfChain {
    set(opts: Record<string, unknown>): Html2PdfChain;
    from(el: HTMLElement): Html2PdfChain;
    save(): Promise<void>;
    toPdf(): Html2PdfChain;
    output(type?: string): Promise<unknown>;
  }
  function html2pdf(): Html2PdfChain;
  function html2pdf(el: HTMLElement, opts?: Record<string, unknown>): Html2PdfChain;
  export default html2pdf;
}
