这是一个借助iframe执行网页打印的组件。

### 个人理解

```js
iframe.contentWindow === window;
iframe.contentWindow.print === window.print; // 借助iframe窗口具有window窗口相同功能的api的原理，此打印函数会打印body里的内容。
iframe.contentDocument === document;
iframe.contentDocument.write === document.write;
```

现在有一个网页打印的需求，然后根据上面的等式。我们知道我们可以借助iframe实现这个需求。

```js
于是我们创建iframe：
document.createElement('iframe');

并将iframe嵌入到页面中：
document.body.appendChild(iframe)

在iframe的onload中将我们想要打印的内容嵌入到iframe的body中，这里我们可以把想要打印的内容作为一个组件component：
iframe.contentDocument.open()
iframe.contentDocument.write(component)
iframe.contentDocument.close()

然后将原页面上的css样式全部拷贝到iframe的head中，这样我们就可以控制我们需要打印的内容的样式。

最后调用iframe.contentWindow.print将iframe body中的内容打印出来。
```

### 收获

__真实DOM和React对象的区别__

1. 真实DOM对象具有很多内置的api，而react组件对象则不存在这些api。于是，当我们想用一些内置的api时，可以用react-dom提供的findDOMNode获取到真实DOM。

1. 而当我们要调用react提供的api如React.cloneElement等，则需要的是ReactNode

__onload事件__

1. onload事件是资源加载完（link、script、iframe、img，好像带有src或href属性的tag都会有onload事件）的时候触发，而不是DOM加载完的时候触发。

__DOMContentLoaded__

1. 当初始的 HTML 文档被完全加载和解析完成之后（即网页的DOM结构完全加载和解析完之后），DOMContentLoaded 事件被触发，而无需等待样式表、图像和子框架的完成加载。`注意：DOMContentLoaded 事件必须等待其所属script之前的样式表加载解析完成才会触发。`

__style对象__

head中的style对象，保存着相关的css样式信息。

```js
style.sheet.cssRules  // 获取到该style对象里的所有样式的数组集合
style.sheet.cssRules[0].cssText  // 获取到该style对象里的样式数组集合里的第一个包含的样式字符串
```

__React.cloneElement__

克隆一个ReactNode并返回一个新的ReactNode。

```js
React.cloneElement( element, [props], [...children] )
大致相当于：
<element.type {...element.props} {...props}>{children}</element.type>
```

从上面可以看出，这个fn会保存element原本的props，在此基础上覆盖使用此方法时传入的新props，也就是可以对原props进行修改。然后新的children会完全覆盖原本的children。key和ref则会被保存下来。

__React.Children__

React.Children对象是React提供的操作children的对象，里面附带了map，forEach，count，only，toArray等方法。

```js
map，返回一个children数组。如果 children 是 null 或 undefined ，返回 null 或 undefined。
const { children } = this.props;
React.Children.map(children, (child, index) => {
    return child;
})
```

```js
forEach，同map，但是不返回值。
const { children } = this.props;
React.Children.forEach(children, (child, index) => {
    return child;
})
```

```js
count，返回children数组的length，相当于遍历的次数。注意当children为函数的时候，count不计入次数。
const { children } = this.props;
React.Children.count(children)
```

```js
only，返回children里仅有的子级。否则抛出异常。
const { children } = this.props;
React.Children.only(children)
```

```js
toArray，返回以赋key给每个子级 child 的扁平数组形式来组成不透明的 children 数据结构。然后可以通过每个子级child的key来进行children的增删查改排序等操作
const { children } = this.props;
React.Children.toArray(children).sort((a, b) => {
    return b.key - a.key  // 逆序
})
```

