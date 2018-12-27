import React from "react";
import PropTypes from "prop-types";
import withSideEffect from "react-side-effect";
import deepEqual from "deep-equal";
import {
  convertReactPropstoHtmlAttributes,
  handleClientStateChange,
  mapStateOnServer,
  reducePropsToState,
  warn
} from "./HelmetUtils.js";
import {TAG_NAMES, VALID_TAG_NAMES} from "./HelmetConstants.js";

const Helmet = (Component) => { // Component => SideEffect(NullComponent)
  
  // react-helmet库最终返回的函数，也就是我们用到的Helmet组件。
  class HelmetWrapper extends React.Component {
    
    /**
     * 允许传入的props，目前我们只用到其中title属性，用来更改多页应用中不同页面的title
     * @param {Object} base: {"target": "_blank", "href": "http://mysite.com/"}
     * @param {Object} bodyAttributes: {"className": "root"}
     * @param {String} defaultTitle: "Default Title"
     * @param {Boolean} defer: true
     * @param {Boolean} encodeSpecialCharacters: true
     * @param {Object} htmlAttributes: {"lang": "en", "amp": undefined}
     * @param {Array} link: [{"rel": "canonical", "href": "http://mysite.com/example"}]
     * @param {Array} meta: [{"name": "description", "content": "Test description"}]
     * @param {Array} noscript: [{"innerHTML": "<img src='http://mysite.com/js/test.js'"}]
     * @param {Function} onChangeClientState: "(newState) => console.log(newState)"
     * @param {Array} script: [{"type": "text/javascript", "src": "http://mysite.com/js/test.js"}]
     * @param {Array} style: [{"type": "text/css", "cssText": "div { display: block; color: blue; }"}]
     * @param {String} title: "Title"
     * @param {Object} titleAttributes: {"itemprop": "name"}
     * @param {String} titleTemplate: "MySite.com - %s"
     */
    
    static propTypes = {
      base: PropTypes.object,
      bodyAttributes: PropTypes.object,
      children: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.node),
        PropTypes.node
      ]),
      defaultTitle: PropTypes.string,
      defer: PropTypes.bool,
      encodeSpecialCharacters: PropTypes.bool,
      htmlAttributes: PropTypes.object,
      link: PropTypes.arrayOf(PropTypes.object),
      meta: PropTypes.arrayOf(PropTypes.object),
      noscript: PropTypes.arrayOf(PropTypes.object),
      onChangeClientState: PropTypes.func,
      script: PropTypes.arrayOf(PropTypes.object),
      style: PropTypes.arrayOf(PropTypes.object),
      title: PropTypes.string,
      titleAttributes: PropTypes.object,
      titleTemplate: PropTypes.string
    };
    
    static defaultProps = {
      defer: true,
      encodeSpecialCharacters: true
    };
    
    // Component.peek comes from react-side-effect:
    // For testing, you may use a static peek() method available on the returned component.
    // It lets you get the current state without resetting the mounted instance stack.
    // Don’t use it for anything other than testing.
    static peek = Component.peek;
    
    static rewind = () => {
      let mappedState = Component.rewind();
      if (!mappedState) {
        // provide fallback if mappedState is undefined
        mappedState = mapStateOnServer({
          baseTag: [],
          bodyAttributes: {},
          encodeSpecialCharacters: true,
          htmlAttributes: {},
          linkTags: [],
          metaTags: [],
          noscriptTags: [],
          scriptTags: [],
          styleTags: [],
          title: "",
          titleAttributes: {}
        });
      }
      
      return mappedState;
    };
    
    // 允许用户切换渲染模式，通常会在服务端渲染的时候使用这个将SideEffect(NullComponent).canUseDOM设为false
    static set canUseDOM(canUseDOM) {
      Component.canUseDOM = canUseDOM;
    }
    
    shouldComponentUpdate(nextProps) {
      return !deepEqual(this.props, nextProps); // todo 这里竟然深对比了？性能消耗？
    }
    
    mapNestedChildrenToProps(child, nestedChildren) {
      if (!nestedChildren) {
        return null;
      }
      
      switch (child.type) {
        case TAG_NAMES.SCRIPT:
        case TAG_NAMES.NOSCRIPT:
          return {
            innerHTML: nestedChildren
          };
        
        case TAG_NAMES.STYLE:
          return {
            cssText: nestedChildren
          };
      }
      
      throw new Error(
        `<${child.type} /> elements are self-closing and can not contain children. Refer to our API for more information.`
      );
    }
    
    flattenArrayTypeChildren({
                               child,
                               arrayTypeChildren,
                               newChildProps,
                               nestedChildren
                             }) {
      return {
        ...arrayTypeChildren,
        [child.type]: [
          ...(arrayTypeChildren[child.type] || []),
          {
            ...newChildProps,
            ...this.mapNestedChildrenToProps(child, nestedChildren)
          }
        ]
      };
    }
    
    mapObjectTypeChildren({
                            child,
                            newProps,
                            newChildProps,
                            nestedChildren
                          }) {
      switch (child.type) {
        case TAG_NAMES.TITLE:
          return {
            ...newProps,
            [child.type]: nestedChildren,
            titleAttributes: {...newChildProps}
          };
        
        case TAG_NAMES.BODY:
          return {
            ...newProps,
            bodyAttributes: {...newChildProps}
          };
        
        case TAG_NAMES.HTML:
          return {
            ...newProps,
            htmlAttributes: {...newChildProps}
          };
      }
      
      return {
        ...newProps,
        [child.type]: {...newChildProps}
      };
    }
    
    mapArrayTypeChildrenToProps(arrayTypeChildren, newProps) {
      let newFlattenedProps = {...newProps};
      
      Object.keys(arrayTypeChildren).forEach(arrayChildName => {
        newFlattenedProps = {
          ...newFlattenedProps,
          [arrayChildName]: arrayTypeChildren[arrayChildName]
        };
      });
      
      return newFlattenedProps;
    }
    
    warnOnInvalidChildren(child, nestedChildren) {
      if (process.env.NODE_ENV !== "production") {
        if (!VALID_TAG_NAMES.some(name => child.type === name)) {
          if (typeof child.type === "function") {
            return warn(
              `You may be attempting to nest <Helmet> components within each other, which is not allowed. Refer to our API for more information.`
            );
          }
          
          return warn(
            `Only elements types ${VALID_TAG_NAMES.join(
              ", "
            )} are allowed. Helmet does not support rendering <${child.type}> elements. Refer to our API for more information.`
          );
        }
        
        if (
          nestedChildren &&
          typeof nestedChildren !== "string" &&
          (!Array.isArray(nestedChildren) ||
            nestedChildren.some(
              nestedChild => typeof nestedChild !== "string"
            ))
        ) {
          throw new Error(
            `Helmet expects a string as a child of <${child.type}>. Did you forget to wrap your children in braces? ( <${child.type}>{\`\`}</${child.type}> ) Refer to our API for more information.`
          );
        }
      }
      
      return true;
    }
    
    mapChildrenToProps(children, newProps) {
      let arrayTypeChildren = {};
      
      React.Children.forEach(children, child => {
        if (!child || !child.props) {
          return;
        }
        
        const {children: nestedChildren, ...childProps} = child.props;
        const newChildProps = convertReactPropstoHtmlAttributes(
          childProps
        );
        
        this.warnOnInvalidChildren(child, nestedChildren);
        
        switch (child.type) {
          case TAG_NAMES.LINK:
          case TAG_NAMES.META:
          case TAG_NAMES.NOSCRIPT:
          case TAG_NAMES.SCRIPT:
          case TAG_NAMES.STYLE:
            arrayTypeChildren = this.flattenArrayTypeChildren({
              child,
              arrayTypeChildren,
              newChildProps,
              nestedChildren
            });
            break;
          
          default:
            newProps = this.mapObjectTypeChildren({
              child,
              newProps,
              newChildProps,
              nestedChildren
            });
            break;
        }
      });
      
      newProps = this.mapArrayTypeChildrenToProps(
        arrayTypeChildren,
        newProps
      );
      return newProps;
    }
    
    render() {
      const {children, ...props} = this.props;
      let newProps = {...props};
      
      if (children) {
        // 当我们使用Helmet组件的时候存在以children的方式传入的时候就会调用mapChildrenToProps将children转化为props
        // xinxin 从这里也可以看出包装HelmetWrapper组件的目的是为了拓展可以通过children的方式传入的操作。
        // xinxin 也就是说Helmet组件的核心操作并不在这个组件中，这一层只是处理入参的。
        // xinxin 那么接下来就得看到这个组件的下一层，也就是Component => SideEffect(NullComponent)。
        newProps = this.mapChildrenToProps(children, newProps);
      }
      
      /*
      * newProps = {
      *   defer: true,  默认值
      *   encodeSpecialCharacters: true  默认值
      *   title: this.props.title  用户传入
      * }
      * */
      return <Component {...newProps} />;
    }
  };
  
  return HelmetWrapper;
}

const NullComponent = () => null; // 创建一个返回null的组件NullComponent，因为react-helmet的目的不是body内的UI展示，而是修改head之内的标签。

// xinxin 重点部分，传入了三个主要操作函数给到react-side-effect库提供的函数withSideEffect，之后将NullComponent传进去。
// HelmetSideEffects = withSideEffect()(NullComponent)返回SideEffect组件
const HelmetSideEffects = withSideEffect(
  reducePropsToState,
  handleClientStateChange,
  mapStateOnServer
)(NullComponent);

// 将HelmetSideEffects组件传入到react-helmet提供的Helmet函数，再进行一次包装。
const HelmetExport = Helmet(HelmetSideEffects);

// rewind函数
HelmetExport.renderStatic = HelmetExport.rewind;

export {HelmetExport as Helmet};
// HelmetExport组件就是我们最终会用到的Helmet组件
export default HelmetExport;

// xinxin Helmet组件用法

/*
用法一：作为props的方式传入
<Helmet
  htmlAttributes={{ lang: "en", amp: "undefined" }} // amp takes no value
  titleTemplate="MySite.com - %s"
  defaultTitle="My Default Title"
  titleAttributes={{ itemprop: "name", lang: "en" }}
  title="My Title"
  base={{ target: "_blank", href: "http://mysite.com/" }}
  meta={[
    { name: "description", content: "Helmet application" },
    { property: "og:type", content: "article" }
  ]}
  link={[
    { rel: "canonical", href: "http://mysite.com/example" },
    { rel: "apple-touch-icon", href: "http://mysite.com/img/apple-touch-icon-57x57.png" },
    { rel: "apple-touch-icon", sizes: "72x72", href: "http://mysite.com/img/apple-touch-icon-72x72.png" }
  ]}
  script={[
    { src: "http://include.com/pathtojs.js", type: "text/javascript" },
    { type: "application/ld+json", innerHTML: `{ "@context": "http://schema.org" }` }
  ]}
  noscript={[
    { innerHTML: `<link rel="stylesheet" type="text/css" href="foo.css" />` }
  ]}
  style={[
    { type: "text/css", cssText: "body {background-color: blue;} p {font-size: 12px;}" }
  ]}
  onChangeClientState={(newState) => console.log(newState)}
/>


用法二：作为children的方式传入
<Helmet title="xinxin">
  <html lang="en" amp />
  <body className="root" />
  <title itemProp="name" lang="en">My Plain Title or {`dynamic`} title</title>
  <base target="_blank" href="http://mysite.com/" />
  <meta name="description" content="Helmet application" />
  <meta property="og:type" content="article" />
  <link rel="canonical" href="http://mysite.com/example" />
  <link rel="apple-touch-icon" href="http://mysite.com/img/apple-touch-icon-57x57.png" />
  <link rel="apple-touch-icon" sizes-"72x72" href="http://mysite.com/img/apple-touch-icon-72x72.png" />
</Helmet>
*/
