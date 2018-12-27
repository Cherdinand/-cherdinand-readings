import React, { Component } from 'react';
import ExecutionEnvironment from 'exenv';
import shallowEqual from 'shallowequal';

export default function withSideEffect(
  reducePropsToState, // 当我们用作为props的方式传入的时候，会用这个函数将props修改为适当的格式保存在state（这个state是通过闭包保存在内存中的）中
  handleStateChangeOnClient,
  mapStateOnServer
) {
  if (typeof reducePropsToState !== 'function') {
    throw new Error('Expected reducePropsToState to be a function.');
  }
  if (typeof handleStateChangeOnClient !== 'function') {
    throw new Error('Expected handleStateChangeOnClient to be a function.');
  }
  if (typeof mapStateOnServer !== 'undefined' && typeof mapStateOnServer !== 'function') {
    throw new Error('Expected mapStateOnServer to either be undefined or a function.');
  }
  
  function getDisplayName(WrappedComponent) {
    return WrappedComponent.displayName || WrappedComponent.name || 'Component';
  }
  
  return function wrap(WrappedComponent) {
    // WrappedComponent => NullComponent const NullComponent = () => null;
    if (typeof WrappedComponent !== 'function') {
      throw new Error('Expected WrappedComponent to be a React component.');
    }
    
    // 这里通过闭包的方式在在内存中存入了mountedInstances和state两个字段，应该是核心所在。
    let mountedInstances = []; // 用于保存多个组件实例的数组
    let state; // 用于储存所有我们传入的想要修改的标签的信息
  
    function emitChange() {
      // 首先调用reducePropsToState函数将传入的props映射到state中
      // todo 在创建了多个组件实例的情况下，会将state覆盖？
      state = reducePropsToState(mountedInstances.map(function (instance) {
        return instance.props;
      }));
      
      if (SideEffect.canUseDOM) {
        // 普通渲染
        // 在已有DOM节点的情况下，只是对已经存在的DOM节点进行修改
        handleStateChangeOnClient(state);
      } else if (mapStateOnServer) {
        // 服务端渲染
        // 由于服务端渲染的时候，DOM节点还没生成，所以mapStateOnServer里主要的操作就是生成tag并插入到html中
        state = mapStateOnServer(state);
      }
    }
    
    class SideEffect extends Component {
      // Try to use displayName of wrapped component
      static displayName = `SideEffect(${getDisplayName(WrappedComponent)})`;
      
      // Expose canUseDOM so tests can monkeypatch it
      static canUseDOM = ExecutionEnvironment.canUseDOM; // canUseDOM这个字段是区分服务端渲染和普通渲染，默认为true，对应普通渲染
      
      static peek() {
        return state;
      }
      
      static rewind() {
        if (SideEffect.canUseDOM) {
          throw new Error('You may only call rewind() on the server. Call peek() to read the current state.');
        }
  
        let recordedState = state;
        state = undefined;
        mountedInstances = [];
        return recordedState;
      }
      
      shouldComponentUpdate(nextProps) {
        return !shallowEqual(nextProps, this.props);
      }
      
      componentWillMount() {
        mountedInstances.push(this);  // 初始化的时候将SideEffect实例存入mountedInstances中
        emitChange();
      }
      
      componentDidUpdate() {
        emitChange();
      }
      
      componentWillUnmount() {
        const index = mountedInstances.indexOf(this);
        mountedInstances.splice(index, 1);
        emitChange();
      }
      
      render() {
        return <WrappedComponent {...this.props} />;
      }
    }
    
    return SideEffect;
  }
}
