import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BrownianBridge from '../../components/pieces/brownian-bridge.vue'

const mocks = vi.hoisted(() => ({
  regenerate: vi.fn(),
  replayConditioning: vi.fn(),
  setReducedMotion: vi.fn(),
  setParameters: vi.fn(),
  destroy: vi.fn(),
  mountSimulation: vi.fn(),
}))

vi.mock('../../pieces/brownian-bridge/simulation', () => ({ mountBrownianBridge: mocks.mountSimulation }))

describe('brownian-bridge', () => {
  beforeEach(() => {
    mocks.regenerate.mockReset()
    mocks.replayConditioning.mockReset()
    mocks.setReducedMotion.mockReset()
    mocks.setParameters.mockReset()
    mocks.destroy.mockReset()
    mocks.mountSimulation.mockReset().mockReturnValue({
      regenerate: mocks.regenerate,
      replayConditioning: mocks.replayConditioning,
      setReducedMotion: mocks.setReducedMotion,
      setParameters: mocks.setParameters,
      destroy: mocks.destroy,
    })
  })

  it('mounts the comparison and exposes path controls', async () => {
    const wrapper = mount(BrownianBridge)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('New paths'))!
      .trigger('click')
    expect(mocks.regenerate).toHaveBeenCalledOnce()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Replay'))!
      .trigger('click')
    expect(mocks.replayConditioning).toHaveBeenCalledOnce()
  })

  it('updates the simulation when the endpoint moves', async () => {
    const wrapper = mount(BrownianBridge)
    await flushPromises()
    await wrapper.get('[aria-label="Terminal endpoint b"]').setValue('1.25')
    expect(mocks.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({ endpoint: 1.25 }))
  })

  it('destroys the simulation on unmount', async () => {
    const wrapper = mount(BrownianBridge)
    await flushPromises()
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })
})
