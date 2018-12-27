import React from 'react';
import { findDOMNode } from 'react-dom';
import PropTypes from 'prop-types';

class ReactToPrint extends React.Component {
  static propTypes = {
    /** Copy styles over into print window. default: true */
    copyStyles: PropTypes.bool,
    /** Trigger action used to open browser print */
    trigger: PropTypes.func.isRequired,
    /** Content to be printed */
    content: PropTypes.func.isRequired,
    /** Callback function to trigger before print */
    onBeforePrint: PropTypes.func,
    /** Callback function to trigger after print */
    onAfterPrint: PropTypes.func,
    /** Override default print window styling */
    pageStyle: PropTypes.string,
    /** Optional class to pass to the print window body */
    bodyClass: PropTypes.string,
  };

  static defaultProps = {
    bodyClass: '',
    copyStyles: true,
    onAfterPrint: false,
    onBeforePrint: false,
    pageStyle: undefined,
  };

  removeWindow = (target) => {
    setTimeout(() => {
      target.parentNode.removeChild(target);
    }, 500);
  }

  triggerPrint = (target) => {
    const { onBeforePrint, onAfterPrint } = this.props;

    if (onBeforePrint) {
      onBeforePrint();
    }

    setTimeout(() => {
      target.contentWindow.focus();
      target.contentWindow.print();
      
      // 触发打印功能之后把嵌入到页面中的iframe实例删除
      this.removeWindow(target);

      if (onAfterPrint) {
        onAfterPrint();
      }
    }, 500);
  }

  handlePrint = () => {
    const {
      bodyClass,
      content,
      copyStyles,
      pageStyle,
    } = this.props;

    const contentEl = content();

    if (contentEl === undefined) {
      console.error("Refs are not available for stateless components. For 'react-to-print' to work only Class based components can be printed"); // eslint-disable-line no-console
      return;
    }

    // 创建iframe实例，并为其设置很大的定位值，在不影响用户界面的情况下将我们所需要的打印内容加入到iframe中
    const printWindow = document.createElement('iframe');
    printWindow.style.position = 'absolute';
    printWindow.style.top = '-1000px';
    printWindow.style.left = '-1000px';

    const contentNodes = findDOMNode(contentEl); // 得到要打印的组件的真实DOM，为了用真实DOM对象提供的原生方法
    const linkNodes = document.querySelectorAll('link[rel="stylesheet"]');  // 得到网页head中（注意不是iframe中的）link的css样式表数组

    this.linkTotal = linkNodes.length || 0;
    this.linksLoaded = [];
    this.linksErrored = [];

    //
    const markLoaded = (linkNode, loaded) => {
      if (loaded) {
        this.linksLoaded.push(linkNode);
      } else {
        console.error("'react-to-print' was unable to load a link. It may be invalid. 'react-to-print' will continue attempting to print the page. The link the errored was:", linkNode); // eslint-disable-line no-console
        this.linksErrored.push(linkNode);
      }

      // We may have errors, but attempt to print anyways - maybe they are trivial and the user will
      // be ok ignoring them
      if (this.linksLoaded.length + this.linksErrored.length === this.linkTotal) {
        this.triggerPrint(printWindow);
      }
    };
    
    // iframe内的资源加载完时触发
    printWindow.onload = () => {
      /* IE11 support */
      if (window.navigator && window.navigator.userAgent.indexOf('Trident/7.0') > -1) {
        printWindow.onload = null;
      }

      // domDoc => iframe窗口的document对象
      const domDoc = printWindow.contentDocument || printWindow.contentWindow.document;
      const srcCanvasEls = [...contentNodes.querySelectorAll('canvas')];

      domDoc.open(); // 对iframe打开一个新的文档
      domDoc.write(contentNodes.outerHTML); // 将整个打印组件加入到iframe的body中
      domDoc.close(); // 将iframe文档关闭

      // @page { size: auto;  margin: 0mm; } 把打印页面页头的数据去掉
      const defaultPageStyle = pageStyle === undefined
        ? '@page { size: auto;  margin: 0mm; } @media print { body { -webkit-print-color-adjust: exact; } }'
        : pageStyle;

      // 创建style对象，然后append进iframe的head中
      const styleEl = domDoc.createElement('style');
      styleEl.appendChild(domDoc.createTextNode(defaultPageStyle));
      domDoc.head.appendChild(styleEl);

      if (bodyClass.length) {
        domDoc.body.classList.add(bodyClass);
      }

      const canvasEls = domDoc.querySelectorAll('canvas');
      [...canvasEls].forEach((node, index) => {
        node.getContext('2d').drawImage(srcCanvasEls[index], 0, 0);
      });

      // 将页面html的head里的css样式copoy到iframe的head中
      if (copyStyles !== false) {
        const headEls = document.querySelectorAll('style, link[rel="stylesheet"]');

        // 拿到页面的head中所有的link[rel="stylesheet"]和style标签
        [...headEls].forEach((node, index) => {
          if (node.tagName === 'STYLE') {
            const newHeadEl = domDoc.createElement(node.tagName);

            if (node.sheet) {
              let styleCSS = '';

              for (let i = 0; i < node.sheet.cssRules.length; i++) {
                styleCSS += `${node.sheet.cssRules[i].cssText}\r\n`;
              }

              newHeadEl.setAttribute('id', `react-to-print-${index}`);
              newHeadEl.appendChild(domDoc.createTextNode(styleCSS));
              domDoc.head.appendChild(newHeadEl);
            }
          } else {
            const attributes = [...node.attributes];

            const hrefAttr = attributes.filter(attr => attr.nodeName === 'href');
            const hasHref = hrefAttr.length ? !!hrefAttr[0].nodeValue : false;

            // Many browsers will do all sorts of weird things if they encounter an empty `href`
            // tag (which is invalid HTML). Some will attempt to load the current page. Some will
            // attempt to load the page's parent directory. These problems can cause
            // `react-to-print` to stop  without any error being thrown. To avoid such problems we
            // simply do not attempt to load these links.
            if (hasHref) {
              const newHeadEl = domDoc.createElement(node.tagName);

              attributes.forEach((attr) => {
                newHeadEl.setAttribute(attr.nodeName, attr.nodeValue);
              });
  
              // 在这里 newHeadEl === link，所以这里是link.onload
              newHeadEl.onload = markLoaded.bind(null, newHeadEl, true);
              newHeadEl.onerror = markLoaded.bind(null, newHeadEl, false);
              domDoc.head.appendChild(newHeadEl);
            } else {
              console.warn("'react-to-print' encountered a <link> tag with an empty 'href' attribute. In addition to being invalid HTML, this can cause problems in many browsers, and so the <link> was not loaded. The <link> is:", node); // eslint-disable-line no-console
              markLoaded(node, true); // `true` because we've already shown a warning for this
            }
          }
        });
      }

      if (this.linkTotal === 0 || copyStyles === false) {
        this.triggerPrint(printWindow);
      }
    };

    // 将iframe实例插入到页面中
    document.body.appendChild(printWindow);
  }

  setRef = (ref) => {
    this.triggerRef = ref;
  }

  render() {
    const { trigger } = this.props;

    return React.cloneElement(trigger(), {
      onClick: this.handlePrint,
      ref: this.setRef,
    });
  }
}

export default ReactToPrint;
