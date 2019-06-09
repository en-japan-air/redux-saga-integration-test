/* eslint-disable redux-saga/yield-effects */
const { wire } = require('../src/index');
// Library
// eslint-disable-next-line import/order
const { put, takeLatest, takeEvery } = require('redux-saga/effects');

/* Constants */
const LOAD = 'integration-test/LOAD';
const PUT = 'integration-test/PUT';

/* Actions */
function load(value) {
  return {
    type: LOAD,
    value,
  };
}
function putAction(value) {
  return {
    type: PUT,
    value,
  };
}

/* Sagas */
function* putSomething(action) {
  yield put(putAction(action.value));
}
function* sagas() {
  yield takeLatest(LOAD, putSomething);
}
function* every() {
  yield takeEvery(LOAD, putSomething);
}

describe('mock action creators', () => {
  it('puts the mocked action', () => {
    const { dispatch } = wire({
      sagas: [sagas],
    });
    return dispatch(load('one')).then(() => {
      expect(put).toHaveBeenCalledWith(putAction('one'));
    });
  });
});

describe('takeLatest', () => {
  it('calls the mocked saga', () => {
    const mockPutSomething = jest.fn();
    const { dispatch } = wire({
      sagas: [sagas],
      mocks: [
        [putSomething, mockPutSomething],
      ],
    });
    return dispatch(load('one')).then(() => {
      expect(mockPutSomething).toHaveBeenCalledWith(load('one'));
    });
  });
});

describe('takeEvery', () => {
  it('calls the mocked saga', () => {
    const mockPutSomething = jest.fn();
    const { dispatch } = wire({
      sagas: [every],
      mocks: [
        [putSomething, mockPutSomething],
      ],
    });
    return dispatch(load('one')).then(() => {
      expect(mockPutSomething).toHaveBeenCalledWith(load('one'));
    });
  });
});
